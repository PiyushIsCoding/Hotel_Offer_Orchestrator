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

const activities = proxyActivities<{
  fetchSupplierA(city: string): Promise<SupplierHotel[]>;
  fetchSupplierB(city: string): Promise<SupplierHotel[]>;
  saveHotelsToRedis(city: string, hotels: ConsolidatedHotel[]): Promise<void>;
  getHotelsFromRedis(
    city: string,
    minPrice?: number,
    maxPrice?: number
  ): Promise<ConsolidatedHotel[]>;
}>({
  startToCloseTimeout: "30 seconds",
  retry: {
    maximumAttempts: 3
  }
});

export async function hotelOfferWorkflow(
  input: HotelWorkflowInput
): Promise<ConsolidatedHotel[]> {
  const { city, minPrice, maxPrice } = input;
  if (!city.trim()) {
    throw ApplicationFailure.nonRetryable("City is required");
  }

  const [supplierAHotels, supplierBHotels] = await Promise.all([
    activities.fetchSupplierA(city),
    activities.fetchSupplierB(city)
  ]);

  const consolidatedHotels = compareAndDeduplicateHotels(
    supplierAHotels,
    supplierBHotels
  );

  await activities.saveHotelsToRedis(city, consolidatedHotels);
  return activities.getHotelsFromRedis(city, minPrice, maxPrice);
}
