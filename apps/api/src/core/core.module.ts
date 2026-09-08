import { Module } from "@nestjs/common";
import { EnvModule } from "./env.module";
import { PrismaModule } from "./prisma.module";
import { RedisModule } from "./redis.module";
import { MailerService } from "./mailer.service";
import { AuditService } from "./audit.service";
import { CsrfMiddleware } from "./csrf.middleware";
import { StorageService } from "./storage.service";

@Module({
  imports: [EnvModule, PrismaModule, RedisModule],
  providers: [MailerService, AuditService, CsrfMiddleware, StorageService],
  exports: [EnvModule, PrismaModule, RedisModule, MailerService, AuditService, StorageService],
})
export class CoreModule {}
