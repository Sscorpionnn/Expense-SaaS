import { Module } from "@nestjs/common";
import { RecurringSweepService } from "./recurring-sweep.service";

@Module({
  providers: [RecurringSweepService],
})
export class RecurringSweepModule {}
