import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [CoreModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
