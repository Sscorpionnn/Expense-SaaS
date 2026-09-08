import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type Redis from "ioredis";
import { PrismaService } from "../core/prisma.service";
import { REDIS_CLIENT } from "../core/redis.module";
import { Public } from "../auth/public.decorator";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check(): Promise<{ status: "ok" }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("Dependency health check failed");
    }
  }
}
