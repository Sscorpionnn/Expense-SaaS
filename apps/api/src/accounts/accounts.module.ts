import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { AccountsService } from "./accounts.service";
import { AccountsController } from "./accounts.controller";

@Module({
  imports: [CoreModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
