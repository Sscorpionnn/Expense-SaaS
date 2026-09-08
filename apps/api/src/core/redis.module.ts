import { Global, Module, type OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { SERVER_ENV, type ServerEnv } from "./env.module";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (env: ServerEnv) => new Redis(env.REDIS_URL, { lazyConnect: false }),
      inject: [SERVER_ENV],
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
