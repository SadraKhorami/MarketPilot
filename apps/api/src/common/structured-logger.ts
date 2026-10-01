import { ConsoleLogger } from "@nestjs/common";

/** Framework startup errors can contain connection strings or stack traces. */
export class StructuredLogger extends ConsoleLogger {
  error(message: unknown) {
    if (typeof message === "object" && message !== null && "event" in message) {
      super.error(message);
      return;
    }
    super.error({ event: "framework_error" });
  }
}
