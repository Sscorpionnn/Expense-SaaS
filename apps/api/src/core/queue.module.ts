import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import Redis from "ioredis";
import { QUEUE_NAMES } from "@expense-saas/config";
import { EnvModule, SERVER_ENV, type ServerEnv } from "./env.module";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [EnvModule],
      inject: [SERVER_ENV],
      useFactory: (env: ServerEnv) => ({
        // BullMQ requires its own connection (maxRetriesPerRequest: null) —
        // it can't share the app's general-purpose Redis client.
        connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }),
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CSV_IMPORT },
      { name: QUEUE_NAMES.DATA_EXPORT },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
