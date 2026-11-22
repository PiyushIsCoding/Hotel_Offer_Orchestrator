import { createHash } from "node:crypto";
import Redis from "ioredis";
import {
  ConsolidatedHotel,
  HotelCacheMetadata,
  HotelWorkflowInput,
  SupplierHotel
} from "../types/hotel";
import {
  RedisDataError,
  RedisUnavailableError,
  SupplierUnavailableError,
  SupplierValidationError
} from "./errors";

const supplierBaseUrl =
  process.env.SUPPLIERS_BASE_URL ?? "http://127.0.0.1:3000";
const cacheTtlSeconds = Math.max(
  1,
  Number(process.env.HOTEL_CACHE_TTL_SECONDS) || 900
);

export interface HotelCacheKeys {
  baseKey: string;
  priceKey: string;
  detailsKey: string;
  metadataKey: string;
}

function normalizedCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, "-");
}

export function getHotelCacheKeys(
  input: Pick<HotelWorkflowInput, "city" | "checkIn" | "checkOut">
): HotelCacheKeys {
  const context = JSON.stringify({
    city: normalizedCity(input.city),
    checkIn: input.checkIn ?? null,
    checkOut: input.checkOut ?? null
  });
  const contextHash = createHash("sha256")
    .update(context)
    .digest("hex")
    .slice(0, 16);
  const baseKey = `hotel-offers:${normalizedCity(input.city)}:${contextHash}`;

  return {
    baseKey,
    priceKey: `${baseKey}:prices`,
    detailsKey: `${baseKey}:details`,
    metadataKey: `${baseKey}:metadata`
  };
}

async function fetchSupplier(
  supplierPath: "supplierA" | "supplierB",
  city: string
): Promise<SupplierHotel[]> {
  const url = new URL(`/supplier${supplierPath === "supplierA" ? "A" : "B"}/hotels`, supplierBaseUrl);
  url.searchParams.set("city", city);
  const startedAt = Date.now();
  const supplier = supplierPath === "supplierA" ? "A" : "B";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new SupplierValidationError(
          `Supplier ${supplier} returned HTTP ${response.status}`
        );
      }

      throw new SupplierUnavailableError(
        `Supplier ${supplier} returned HTTP ${response.status}`
      );
    }

    let hotels: unknown;
    try {
      hotels = await response.json();
    } catch {
      throw new SupplierValidationError(
        `Supplier ${supplier} returned invalid JSON`
      );
    }

    if (!Array.isArray(hotels)) {
      throw new SupplierValidationError(
        `Supplier ${supplier} returned an invalid response`
      );
    }

    console.info(JSON.stringify({
      event: "supplier_fetch_succeeded",
      supplier,
      city,
      recordCount: hotels.length,
      durationMs: Date.now() - startedAt
    }));
    return hotels as SupplierHotel[];
  } catch (error) {
    if (
      error instanceof SupplierValidationError ||
      error instanceof SupplierUnavailableError
    ) {
      console.error(JSON.stringify({
        event: "supplier_fetch_failed",
        supplier,
        city,
        errorType: error.name,
        durationMs: Date.now() - startedAt
      }));
      throw error;
    }

    const unavailableError = new SupplierUnavailableError(
      `Supplier ${supplier} request failed`
    );
    console.error(JSON.stringify({
      event: "supplier_fetch_failed",
      supplier,
      city,
      errorType: unavailableError.name,
      durationMs: Date.now() - startedAt
    }));
    throw unavailableError;
  }
}

export async function fetchSupplierA(city: string): Promise<SupplierHotel[]> {
  return fetchSupplier("supplierA", city);
}

export async function fetchSupplierB(city: string): Promise<SupplierHotel[]> {
  return fetchSupplier("supplierB", city);
}

export async function saveHotelsToRedis(
  input: HotelWorkflowInput,
  hotels: ConsolidatedHotel[]
): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

  try {
    const keys = getHotelCacheKeys(input);
    const refreshedAt = new Date();
    const expiresAt = new Date(
      refreshedAt.getTime() + cacheTtlSeconds * 1000
    );
    const metadata: HotelCacheMetadata = {
      city: input.city.trim().toLowerCase(),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      refreshedAt: refreshedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      recordCount: hotels.length
    };
    const pipeline = redis.pipeline();
    const legacyKeys = [
      `hotel-offers:${normalizedCity(input.city)}`,
      `hotel-offers:${normalizedCity(input.city)}:prices`,
      `hotel-offers:${normalizedCity(input.city)}:details`
    ];

    pipeline.del(
      ...legacyKeys,
      keys.priceKey,
      keys.detailsKey,
      keys.metadataKey
    );
    for (const hotel of hotels) {
      const hotelKey = hotel.name.trim().replace(/\s+/g, " ").toLowerCase();
      pipeline.zadd(keys.priceKey, hotel.price, hotelKey);
      pipeline.hset(keys.detailsKey, hotelKey, JSON.stringify(hotel));
    }
    pipeline.set(
      keys.metadataKey,
      JSON.stringify(metadata),
      "EX",
      cacheTtlSeconds
    );
    pipeline.expire(keys.priceKey, cacheTtlSeconds);
    pipeline.expire(keys.detailsKey, cacheTtlSeconds);

    const replies = await pipeline.exec();
    for (const [error] of replies ?? []) {
      if (error) {
        throw error;
      }
    }
    console.info(JSON.stringify({
      event: "redis_cache_written",
      city: input.city,
      recordCount: hotels.length,
      ttlSeconds: cacheTtlSeconds
    }));
  } catch (error) {
    if (error instanceof RedisDataError) {
      throw error;
    }
    throw new RedisUnavailableError(
      error instanceof Error ? error.message : "Unable to save hotel offers"
    );
  } finally {
    await redis.quit();
  }
}

export async function getHotelsFromRedis(
  input: HotelWorkflowInput
): Promise<ConsolidatedHotel[]> {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

  try {
    const keys = getHotelCacheKeys(input);
    const hotelKeys = await redis.zrangebyscore(
      keys.priceKey,
      input.minPrice ?? "-inf",
      input.maxPrice ?? "+inf"
    );
    const records = await Promise.all(
      hotelKeys.map((hotelKey) => redis.hget(keys.detailsKey, hotelKey))
    );

    try {
      const hotels = records
        .filter((record): record is string => record !== null)
        .map((record) => JSON.parse(record) as ConsolidatedHotel);
      console.info(JSON.stringify({
        event: "redis_cache_read",
        city: input.city,
        recordCount: hotels.length
      }));
      return hotels;
    } catch (error) {
      throw new RedisDataError(
        error instanceof Error ? error.message : "Invalid cached hotel data"
      );
    }
  } catch (error) {
    if (error instanceof RedisDataError) {
      throw error;
    }
    throw new RedisUnavailableError(
      error instanceof Error ? error.message : "Unable to read hotel offers"
    );
  } finally {
    await redis.quit();
  }
}

export async function getHotelCacheMetadata(
  input: Pick<HotelWorkflowInput, "city" | "checkIn" | "checkOut">
): Promise<HotelCacheMetadata | null> {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

  try {
    const metadata = await redis.get(getHotelCacheKeys(input).metadataKey);
    return metadata ? JSON.parse(metadata) as HotelCacheMetadata : null;
  } catch (error) {
    throw new RedisUnavailableError(
      error instanceof Error ? error.message : "Unable to read cache metadata"
    );
  } finally {
    await redis.quit();
  }
}
