import {
  ConsolidatedHotel,
  SupplierHotel,
  SupplierName,
  SupplierOffer
} from "../types/hotel";

const removableSuffixes = new Set(["hotel", "resort", "suites", "inn"]);
const tokenAliases: Array<[RegExp, string]> = [
  [/\bnew\s+york\b/g, "ny"],
  [/\bsan\s+francisco\b/g, "sf"]
];

export function normalizeHotelName(name: string): string {
  let normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of tokenAliases) {
    normalized = normalized.replace(pattern, replacement);
  }

  const tokens = normalized.split(" ").filter(Boolean);
  while (tokens.length > 1 && removableSuffixes.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ");
}

function displayHotelName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(address: string): string {
  return address
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token)
  ).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function metadataSupportsMatch(left: SupplierHotel, right: SupplierHotel): boolean {
  if (normalizeCity(left.city) !== normalizeCity(right.city)) {
    return false;
  }

  if (
    left.starRating !== undefined &&
    right.starRating !== undefined &&
    Math.abs(left.starRating - right.starRating) > 1
  ) {
    return false;
  }

  if (
    left.latitude !== undefined &&
    left.longitude !== undefined &&
    right.latitude !== undefined &&
    right.longitude !== undefined
  ) {
    const latitudeDelta = left.latitude - right.latitude;
    const longitudeDelta = left.longitude - right.longitude;
    if (latitudeDelta ** 2 + longitudeDelta ** 2 > 0.0004) {
      return false;
    }
  }

  if (left.address && right.address) {
    const addressSimilarity = tokenSimilarity(
      normalizeAddress(left.address),
      normalizeAddress(right.address)
    );
    if (addressSimilarity < 0.5) {
      return false;
    }
  }

  return true;
}

function findFuzzyMatch(
  hotel: SupplierHotel,
  candidates: Map<string, SupplierHotel>
): string | undefined {
  const matches = [...candidates.entries()].filter(([, candidate]) => {
    if (!metadataSupportsMatch(hotel, candidate)) {
      return false;
    }

    return tokenSimilarity(
      normalizeHotelName(hotel.name),
      normalizeHotelName(candidate.name)
    ) >= 0.75;
  });

  return matches.length === 1 ? matches[0][0] : undefined;
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

function toSupplierOffer(
  hotel: SupplierHotel,
  supplier: SupplierName
): SupplierOffer {
  return {
    ...hotel,
    supplier,
    name: displayHotelName(hotel.name)
  };
}

function toConsolidatedHotel(
  selected: SupplierHotel,
  supplier: SupplierName,
  alternates: SupplierOffer[]
): ConsolidatedHotel {
  const result: ConsolidatedHotel = {
    name: displayHotelName(selected.name),
    price: selected.price,
    supplier,
    commissionPct: selected.commissionPct
  };

  if (alternates.length > 0) {
    result.alternateOffers = alternates;
  }

  return result;
}

export function compareAndDeduplicateHotels(
  supplierAHotels: SupplierHotel[],
  supplierBHotels: SupplierHotel[]
): ConsolidatedHotel[] {
  const supplierA = selectCheapestWithinSupplier(supplierAHotels);
  const supplierB = selectCheapestWithinSupplier(supplierBHotels);
  const unmatchedB = new Map(supplierB);
  const results: ConsolidatedHotel[] = [];

  for (const [nameA, offerA] of supplierA) {
    const exactOfferB = unmatchedB.get(nameA);
    const nameB = exactOfferB && metadataSupportsMatch(offerA, exactOfferB)
      ? nameA
      : findFuzzyMatch(offerA, unmatchedB);
    const offerB = nameB ? unmatchedB.get(nameB) : undefined;

    if (!offerB || !nameB) {
      results.push(toConsolidatedHotel(offerA, "Supplier A", []));
      continue;
    }

    unmatchedB.delete(nameB);
    const selected = offerA.price <= offerB.price
      ? toSupplierOffer(offerA, "Supplier A")
      : toSupplierOffer(offerB, "Supplier B");
    const alternate = selected.supplier === "Supplier A"
      ? toSupplierOffer(offerB, "Supplier B")
      : toSupplierOffer(offerA, "Supplier A");

    results.push(
      toConsolidatedHotel(
        selected,
        selected.supplier,
        [alternate]
      )
    );
  }

  for (const offerB of unmatchedB.values()) {
    results.push(toConsolidatedHotel(offerB, "Supplier B", []));
  }

  return results.sort((left, right) =>
    normalizeHotelName(left.name).localeCompare(normalizeHotelName(right.name))
  );
}
