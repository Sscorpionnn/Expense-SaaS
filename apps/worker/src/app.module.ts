import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { EnvModule } from "./core/env.module";
import { PrismaModule } from "./core/prisma.module";
import { StorageModule } from "./core/storage.module";
import { RecurringSweepModule } from "./recurring/recurring-sweep.module";
import { CsvImportModule } from "./csv-import/csv-import.module";
import { DataExportModule } from "./data-export/data-export.module";
import { AccountDeletionModule } from "./account-deletion/account-deletion.module";

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    StorageModule,
    ScheduleModule.forRoot(),
    RecurringSweepModule,
    CsvImportModule,
    DataExportModule,
    AccountDeletionModule,
  ],
})
export class AppModule {}
