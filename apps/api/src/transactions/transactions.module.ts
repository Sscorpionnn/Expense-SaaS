import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { TransactionsService } from "./transactions.service";
import { TransactionsController } from "./transactions.controller";

@Module({
  imports: [CoreModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
