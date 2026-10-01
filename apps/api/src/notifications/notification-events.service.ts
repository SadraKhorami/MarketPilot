import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database.module";

/** Important product events only; the audit trail remains separate from the inbox. */
@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);
  constructor(private readonly db: DatabaseService) {}
  async security(userId: string, title: string, body: string, actionPath: string) {
    try {
      await this.db.notification.create({
        data: { userId, category: "SECURITY", severity: "INFO", title, body, actionPath },
      });
    } catch {
      // A notification failure must not change the outcome of an already completed sign-in/key operation.
      this.logger.error({ event: "security_notification_failed" });
    }
  }
  async registered(userId: string, identity: string) {
    try {
      await this.db.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            userId,
            category: "ACCOUNT",
            title: "Welcome to MarketPilot",
            body: "Your account is ready. Follow markets, save your watchlist and explore sourced market news.",
            actionPath: "/dashboard/markets",
          },
        });
        const admins = await tx.user.findMany({
          where: { status: "ACTIVE", roles: { some: { role: { name: "ADMIN" } } } },
          select: { id: true },
        });
        if (admins.length)
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              category: "ACCOUNT" as const,
              title: "New account registered",
              body: `${identity} joined MarketPilot. Review their account in the user directory.`,
              actionPath: "/dashboard/admin/users",
            })),
          });
      });
    } catch {
      this.logger.error({ event: "registration_notifications_failed" });
    }
  }
}
