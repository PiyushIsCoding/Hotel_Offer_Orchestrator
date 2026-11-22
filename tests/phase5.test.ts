import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getHotelCacheKeys,
  getHotelCacheMetadata,
  getHotelsFromRedis,
  saveHotelsToRedis
} from "../src/temporal/activities";
import { ConsolidatedHotel, HotelWorkflowInput } from "../src/types/hotel";

const context: HotelWorkflowInput = { city: "phase-five-test" };
const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

const hotels: ConsolidatedHotel[] = [
  {
    name: "Budget Hotel",
    price: 3000,
    supplier: "Supplier A",
    commissionPct: 10
  },
  {
    name: "Midrange Hotel",
    price: 6000,
    supplier: "Supplier B",
    commissionPct: 15
  },
  {
    name: "Luxury Hotel",
    price: 12000,
    supplier: "Supplier A",
    commissionPct: 20
  }
];

describe("Phase 5: Redis storage and filtering", () => {
  beforeAll(async () => {
    await redis.ping();
  });

  beforeEach(async () => {
    await saveHotelsToRedis(context, hotels);
  });

  afterAll(async () => {
    const keys = getHotelCacheKeys(context);
    await redis.del(
      keys.priceKey,
      keys.detailsKey,
      keys.metadataKey,
      getHotelCacheKeys({ ...context, checkIn: "2026-12-01" }).priceKey,
      getHotelCacheKeys({ ...context, checkIn: "2026-12-01" }).detailsKey,
      getHotelCacheKeys({ ...context, checkIn: "2026-12-01" }).metadataKey
    );
    await redis.quit();
  });

  it("stores and returns all consolidated records", async () => {
    await expect(getHotelsFromRedis(context)).resolves.toEqual([
      hotels[0],
      hotels[1],
      hotels[2]
    ]);
  });

  it("filters by both price bounds inside Redis", async () => {
    await expect(getHotelsFromRedis({ ...context, minPrice: 4000, maxPrice: 8000 })).resolves.toEqual([
      hotels[1]
    ]);
  });

  it("supports min-only and max-only filters", async () => {
    await expect(getHotelsFromRedis({ ...context, minPrice: 6000 })).resolves.toEqual([
      hotels[1],
      hotels[2]
    ]);
    await expect(getHotelsFromRedis({ ...context, maxPrice: 6000 })).resolves.toEqual([
      hotels[0],
      hotels[1]
    ]);
  });

  it("removes stale records when a city is refreshed", async () => {
    await saveHotelsToRedis(context, [hotels[1]]);

    await expect(getHotelsFromRedis(context)).resolves.toEqual([hotels[1]]);
  });

  it("isolates cache entries by check-in context", async () => {
    const datedContext = {
      ...context,
      checkIn: "2026-12-01",
      checkOut: "2026-12-05"
    };
    await saveHotelsToRedis(datedContext, [hotels[2]]);

    await expect(getHotelsFromRedis(context)).resolves.toEqual(hotels);
    await expect(getHotelsFromRedis(datedContext)).resolves.toEqual([hotels[2]]);
  });

  it("stores refresh metadata and applies a TTL", async () => {
    const keys = getHotelCacheKeys(context);
    const metadata = await getHotelCacheMetadata(context);

    expect(metadata).toMatchObject({
      city: "phase-five-test",
      recordCount: 3
    });
    expect(new Date(metadata!.expiresAt).getTime()).toBeGreaterThan(
      new Date(metadata!.refreshedAt).getTime()
    );
    expect(await redis.ttl(keys.metadataKey)).toBeGreaterThan(0);
  });
});
