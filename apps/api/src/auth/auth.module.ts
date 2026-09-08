import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { SessionAuthGuard } from "./session-auth.guard";

@Module({
  imports: [CoreModule],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
