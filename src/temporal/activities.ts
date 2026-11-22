import Redis from "ioredis";
import { ConsolidatedHotel, SupplierHotel } from "../types/hotel";

const supplierBaseUrl =
  process.env.SUPPLIERS_BASE_URL ?? "http://127.0.0.1:3000";

async function fetchSupplier(
  supplierPath: "supplierA" | "supplierB",
  city: string
): Promise<SupplierHotel[]> {
  const url = new URL(`/supplier${supplierPath === "supplierA" ? "A" : "B"}/hotels`, supplierBaseUrl);
  url.searchParams.set("city", city);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Supplier ${supplierPath === "supplierA" ? "A" : "B"} returned HTTP ${response.status}`
      );
    }

    const hotels = await response.json();
    if (!Array.isArray(hotels)) {
      throw new Error(`Supplier ${supplierPath} returned an invalid response`);
    }

    return hotels as SupplierHotel[];
  } catch (error) {
    throw new Error(
      `SUPPLIER_FAILURE: ${error instanceof Error ? error.message : "Unable to fetch supplier offers"}`
    );
  }
}

export async function fetchSupplierA(city: string): Promise<SupplierHotel[]> {
  return fetchSupplier("supplierA", city);
}

export async function fetchSupplierB(city: string): Promise<SupplierHotel[]> {
  return fetchSupplier("supplierB", city);
}

export async function saveHotelsToRedis(
  city: string,
  hotels: ConsolidatedHotel[]
): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

  try {
    const normalizedCity = city.trim().toLowerCase();
    const legacyKey = `hotel-offers:${normalizedCity}`;
    const priceKey = `hotel-offers:${normalizedCity}:prices`;
    const detailsKey = `hotel-offers:${normalizedCity}:details`;
    const pipeline = redis.pipeline();

    pipeline.del(legacyKey, priceKey, detailsKey);
    for (const hotel of hotels) {
      const hotelKey = hotel.name.trim().replace(/\s+/g, " ").toLowerCase();
      pipeline.zadd(priceKey, hotel.price, hotelKey);
      pipeline.hset(detailsKey, hotelKey, JSON.stringify(hotel));
    }

    const replies = await pipeline.exec();
    for (const [error] of replies ?? []) {
      if (error) {
        throw error;
      }
    }
  } catch (error) {
    throw new Error(
      `REDIS_FAILURE: ${error instanceof Error ? error.message : "Unable to save hotel offers"}`
    );
  } finally {
    await redis.quit();
  }
}

export async function getHotelsFromRedis(
  city: string,
  minPrice?: number,
  maxPrice?: number
): Promise<ConsolidatedHotel[]> {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

  try {
    const normalizedCity = city.trim().toLowerCase();
    const priceKey = `hotel-offers:${normalizedCity}:prices`;
    const detailsKey = `hotel-offers:${normalizedCity}:details`;
    const hotelKeys = await redis.zrangebyscore(
      priceKey,
      minPrice ?? "-inf",
      maxPrice ?? "+inf"
    );
    const records = await Promise.all(
      hotelKeys.map((hotelKey) => redis.hget(detailsKey, hotelKey))
    );

    return records
      .filter((record): record is string => record !== null)
      .map((record) => JSON.parse(record) as ConsolidatedHotel);
  } catch (error) {
    throw new Error(
      `REDIS_FAILURE: ${error instanceof Error ? error.message : "Unable to read hotel offers"}`
    );
  } finally {
    await redis.quit();
  }
}
