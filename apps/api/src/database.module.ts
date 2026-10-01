import { PrismaClient, RoleName } from "@marketpilot/db";
import { type BeforeApplicationShutdown, Global, Injectable, Module, type OnModuleInit } from "@nestjs/common";

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, BeforeApplicationShutdown {
  async beforeApplicationShutdown() {
    await this.$disconnect();
  }
  async onModuleInit() {
    await this.$connect();
    for (const name of Object.values(RoleName)) {
      await this.role.upsert({ where: { name }, update: {}, create: { name } });
    }
  }
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
