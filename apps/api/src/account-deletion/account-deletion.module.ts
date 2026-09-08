import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { AccountDeletionService } from "./account-deletion.service";
import { AccountDeletionController } from "./account-deletion.controller";

@Module({
  imports: [CoreModule],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService],
})
export class AccountDeletionModule {}
