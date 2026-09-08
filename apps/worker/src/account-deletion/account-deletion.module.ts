import { Module } from "@nestjs/common";
import { PrismaModule } from "../core/prisma.module";
import { StorageModule } from "../core/storage.module";
import { AccountDeletionPurgeService } from "./account-deletion-purge.service";

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [AccountDeletionPurgeService],
})
export class AccountDeletionModule {}
