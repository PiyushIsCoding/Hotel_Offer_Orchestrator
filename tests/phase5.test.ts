import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getHotelsFromRedis,
  saveHotelsToRedis
} from "../src/temporal/activities";
import { ConsolidatedHotel } from "../src/types/hotel";

const city = "phase-five-test";
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
    await saveHotelsToRedis(city, hotels);
  });

  afterAll(async () => {
    await redis.del(
      `hotel-offers:${city}`,
      `hotel-offers:${city}:prices`,
      `hotel-offers:${city}:details`
    );
    await redis.quit();
  });

  it("stores and returns all consolidated records", async () => {
    await expect(getHotelsFromRedis(city)).resolves.toEqual([
      hotels[0],
      hotels[1],
      hotels[2]
    ]);
  });

  it("filters by both price bounds inside Redis", async () => {
    await expect(getHotelsFromRedis(city, 4000, 8000)).resolves.toEqual([
      hotels[1]
    ]);
  });

  it("supports min-only and max-only filters", async () => {
    await expect(getHotelsFromRedis(city, 6000)).resolves.toEqual([
      hotels[1],
      hotels[2]
    ]);
    await expect(getHotelsFromRedis(city, undefined, 6000)).resolves.toEqual([
      hotels[0],
      hotels[1]
    ]);
  });

  it("removes stale records when a city is refreshed", async () => {
    await saveHotelsToRedis(city, [hotels[1]]);

    await expect(getHotelsFromRedis(city)).resolves.toEqual([hotels[1]]);
  });
});
