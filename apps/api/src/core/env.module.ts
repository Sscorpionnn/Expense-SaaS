import { Global, Module } from "@nestjs/common";
import { parseServerEnv, type ServerEnv } from "@expense-saas/config";

export const SERVER_ENV = Symbol("SERVER_ENV");

@Global()
@Module({
  providers: [
    {
      provide: SERVER_ENV,
      useFactory: (): ServerEnv => parseServerEnv(),
    },
  ],
  exports: [SERVER_ENV],
})
export class EnvModule {}

export type { ServerEnv };
