import { Module } from "@nestjs/common";
import { ActivityService } from "../common/activity.service";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
@Module({ controllers: [AdminController, JobsController], providers: [AdminService, JobsService, ActivityService] })
export class AdminModule {}
