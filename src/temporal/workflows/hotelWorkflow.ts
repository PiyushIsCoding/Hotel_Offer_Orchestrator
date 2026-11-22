import {
  ApplicationFailure,
  proxyActivities
} from "@temporalio/workflow";
import { compareAndDeduplicateHotels } from "../../services/hotelComparisonService";
import {
  ConsolidatedHotel,
  HotelWorkflowInput,
  SupplierHotel
} from "../../types/hotel";

const supplierActivities = proxyActivities<{
  fetchSupplierA(city: string): Promise<SupplierHotel[]>;
  fetchSupplierB(city: string): Promise<SupplierHotel[]>;
}>({
  startToCloseTimeout: "15 seconds",
  retry: {
    initialInterval: "1 second",
    maximumInterval: "10 seconds",
    maximumAttempts: 3,
    nonRetryableErrorTypes: ["SupplierValidationError"]
  }
});

const redisActivities = proxyActivities<{
  saveHotelsToRedis(
    input: HotelWorkflowInput,
    hotels: ConsolidatedHotel[]
  ): Promise<void>;
  getHotelsFromRedis(input: HotelWorkflowInput): Promise<ConsolidatedHotel[]>;
  getHotelCacheMetadata(
    input: Pick<HotelWorkflowInput, "city" | "checkIn" | "checkOut">
  ): Promise<import("../../types/hotel").HotelCacheMetadata | null>;
}>({
  startToCloseTimeout: "10 seconds",
  retry: {
    initialInterval: "1 second",
    maximumInterval: "5 seconds",
    maximumAttempts: 3,
    nonRetryableErrorTypes: ["RedisDataError"]
  }
});

export async function hotelOfferWorkflow(
  input: HotelWorkflowInput
): Promise<ConsolidatedHotel[]> {
  const { city } = input;
  if (!city.trim()) {
    throw ApplicationFailure.nonRetryable("City is required");
  }

  if (!input.refresh) {
    const cacheMetadata = await redisActivities.getHotelCacheMetadata(input);
    if (cacheMetadata) {
      return redisActivities.getHotelsFromRedis(input);
    }
  }

  const [supplierAHotels, supplierBHotels] = await Promise.all([
    supplierActivities.fetchSupplierA(city),
    supplierActivities.fetchSupplierB(city)
  ]);

  const consolidatedHotels = compareAndDeduplicateHotels(
    supplierAHotels,
    supplierBHotels
  );

  await redisActivities.saveHotelsToRedis(input, consolidatedHotels);
  return redisActivities.getHotelsFromRedis(input);
}
