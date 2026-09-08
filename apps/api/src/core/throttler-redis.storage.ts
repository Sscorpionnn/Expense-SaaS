import { Inject, Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.module";

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Redis-backed rate-limit counter so limits are enforced correctly across
 * multiple API instances (the bundled in-memory ThrottlerStorage is
 * per-process and would let an attacker bypass limits by hitting different
 * instances behind a load balancer).
 *
 * Atomic via a single Lua script — avoids the increment/expire race that a
 * naive INCR-then-PEXPIRE would have under concurrent requests.
 */
const INCREMENT_SCRIPT = `
local hitsTtl = redis.call('PTTL', KEYS[2])
if hitsTtl and hitsTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {hits, hitsTtl, 1, hitsTtl}
end

local totalHits = redis.call('INCR', KEYS[1])
if totalHits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttlRemaining = redis.call('PTTL', KEYS[1])
if ttlRemaining < 0 then ttlRemaining = 0 end

local isBlocked = 0
local timeToBlockExpire = 0
if totalHits > tonumber(ARGV[2]) then
  isBlocked = 1
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  timeToBlockExpire = tonumber(ARGV[3])
end

return {totalHits, ttlRemaining, isBlocked, timeToBlockExpire}
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:${throttlerName}:${key}:hits`;
    const blockKey = `throttle:${throttlerName}:${key}:blocked`;

    const [totalHits, ttlRemainingMs, isBlocked, timeToBlockExpireMs] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      hitsKey,
      blockKey,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire: Math.ceil(ttlRemainingMs / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
    };
  }
}
