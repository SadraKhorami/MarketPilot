import { Module } from "@nestjs/common";
import { AnnouncementsController } from "./announcements.controller";
import { AnnouncementsService } from "./announcements.service";
import { NotificationEventsService } from "./notification-events.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
@Module({
  controllers: [NotificationsController, AnnouncementsController],
  providers: [NotificationsService, NotificationEventsService, AnnouncementsService],
  exports: [NotificationEventsService],
})
export class NotificationsModule {}
