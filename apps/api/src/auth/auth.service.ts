import { createHash, randomBytes } from "node:crypto";
import { RoleName, UserStatus } from "@marketpilot/db";
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcrypt";

import { ActivityService } from "../common/activity.service";
import { DatabaseService } from "../database.module";

const SESSION_DAYS = 14;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityService,
  ) {}

  async register(input: { email: string; password: string; name?: string }) {
    this.assertPasswordLength(input.password);
    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const userRole = await this.db.role.findUniqueOrThrow({ where: { name: RoleName.USER } });

    try {
      const user = await this.db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: input.name?.trim() || null,
            roles: { create: { roleId: userRole.id } },
            watchlists: { create: { name: "Main watchlist" } },
            channels: { create: { provider: "WEB", active: true, verifiedAt: new Date() } },
          },
          include: { roles: { include: { role: true } } },
        });
        return created;
      });

      await this.activity.record(user.id, "USER_REGISTERED", "Account created");
      return this.createSession(
        user.id,
        user.email,
        user.name,
        user.roles.map((item) => item.role.name),
      );
    } catch (error) {
      if (isUniqueError(error))
        throw new ConflictException({
          error: { code: "EMAIL_EXISTS", message: "An account with this email already exists." },
        });
      throw error;
    }
  }

  async login(input: { email: string; password: string }) {
    this.assertPasswordLength(input.password);
    const user = await this.db.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.status !== UserStatus.ACTIVE || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException({
        error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." },
      });
    }
    await this.activity.record(user.id, "USER_SIGNED_IN", "Signed in");
    return this.createSession(
      user.id,
      user.email,
      user.name,
      user.roles.map((item) => item.role.name),
    );
  }

  async validateSession(rawToken: string) {
    const session = await this.db.session.findUnique({
      where: { tokenHash: hash(rawToken) },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE)
      return null;

    await this.db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        roles: session.user.roles.map((item) => item.role.name),
        sessionId: session.id,
      },
    };
  }

  async logout(sessionId: string) {
    await this.db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  listSessions(userId: string) {
    return this.db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.db.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  private async createSession(userId: string, email: string, name: string | null, roles: RoleName[]) {
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const session = await this.db.session.create({ data: { userId, tokenHash: hash(rawToken), expiresAt } });
    return { rawToken, expiresAt, sessionId: session.id, user: { id: userId, email, name, roles } };
  }

  private assertPasswordLength(password: string) {
    if (Buffer.byteLength(password, "utf8") > 72) {
      throw new BadRequestException({
        error: { code: "PASSWORD_TOO_LONG", message: "Password must not exceed 72 UTF-8 bytes." },
      });
    }
  }
}

function isUniqueError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
