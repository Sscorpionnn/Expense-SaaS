import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Worker");
  await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  logger.log("Worker started — running scheduled jobs (recurring-transaction reminders).");
}

void bootstrap();
