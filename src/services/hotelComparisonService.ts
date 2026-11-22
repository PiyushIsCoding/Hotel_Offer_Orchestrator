import {
  ConsolidatedHotel,
  SupplierHotel
} from "../types/hotel";

export function normalizeHotelName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function compareDuplicateOffers(
  left: SupplierHotel,
  right: SupplierHotel
): SupplierHotel {
  if (left.price !== right.price) {
    return left.price < right.price ? left : right;
  }

  return left.hotelId.localeCompare(right.hotelId) <= 0 ? left : right;
}

function selectCheapestWithinSupplier(
  hotels: SupplierHotel[]
): Map<string, SupplierHotel> {
  const selected = new Map<string, SupplierHotel>();

  for (const hotel of hotels) {
    const normalizedName = normalizeHotelName(hotel.name);
    if (!normalizedName) {
      continue;
    }

    const current = selected.get(normalizedName);
    selected.set(
      normalizedName,
      current ? compareDuplicateOffers(current, hotel) : hotel
    );
  }

  return selected;
}

function toConsolidatedHotel(
  hotel: SupplierHotel,
  supplier: "Supplier A" | "Supplier B"
): ConsolidatedHotel {
  return {
    name: hotel.name.trim().replace(/\s+/g, " "),
    price: hotel.price,
    supplier,
    commissionPct: hotel.commissionPct
  };
}

export function compareAndDeduplicateHotels(
  supplierAHotels: SupplierHotel[],
  supplierBHotels: SupplierHotel[]
): ConsolidatedHotel[] {
  const supplierA = selectCheapestWithinSupplier(supplierAHotels);
  const supplierB = selectCheapestWithinSupplier(supplierBHotels);
  const names = new Set([...supplierA.keys(), ...supplierB.keys()]);
  const results: ConsolidatedHotel[] = [];

  for (const normalizedName of names) {
    const offerA = supplierA.get(normalizedName);
    const offerB = supplierB.get(normalizedName);

    if (offerA && !offerB) {
      results.push(toConsolidatedHotel(offerA, "Supplier A"));
      continue;
    }

    if (offerB && !offerA) {
      results.push(toConsolidatedHotel(offerB, "Supplier B"));
      continue;
    }

    if (offerA && offerB) {
      if (offerA.price < offerB.price) {
        results.push(toConsolidatedHotel(offerA, "Supplier A"));
      } else if (offerB.price < offerA.price) {
        results.push(toConsolidatedHotel(offerB, "Supplier B"));
      } else {
        results.push(toConsolidatedHotel(offerA, "Supplier A"));
      }
    }
  }

  return results.sort((left, right) =>
    normalizeHotelName(left.name).localeCompare(normalizeHotelName(right.name))
  );
}
