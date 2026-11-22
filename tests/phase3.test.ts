import { describe, expect, it } from "vitest";
import {
  compareAndDeduplicateHotels,
  normalizeHotelName
} from "../src/services/hotelComparisonService";
import { SupplierHotel } from "../src/types/hotel";

function hotel(
  hotelId: string,
  name: string,
  price: number,
  commissionPct = 10
): SupplierHotel {
  return {
    hotelId,
    name,
    price,
    city: "delhi",
    commissionPct
  };
}

describe("Phase 3: comparison and deduplication", () => {
  it("normalizes whitespace and casing", () => {
    expect(normalizeHotelName("  The   Grand  ")).toBe("the grand");
  });

  it("selects the cheapest overlapping offer and preserves its fields", () => {
    expect(
      compareAndDeduplicateHotels(
        [hotel("a1", "Holtin", 6000, 10)],
        [hotel("b1", " holtin ", 5340, 20)]
      )
    ).toEqual([
      {
        name: "holtin",
        price: 5340,
        supplier: "Supplier B",
        commissionPct: 20
      }
    ]);
  });

  it("retains supplier-exclusive hotels", () => {
    const result = compareAndDeduplicateHotels(
      [hotel("a1", "Hotel A", 5000)],
      [hotel("b1", "Hotel B", 7000)]
    );

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.supplier)).toEqual([
      "Supplier A",
      "Supplier B"
    ]);
  });

  it("uses Supplier A for equal cross-supplier prices", () => {
    const result = compareAndDeduplicateHotels(
      [hotel("a1", "Radison", 5900, 13)],
      [hotel("b1", "Radison", 5900, 18)]
    );

    expect(result[0]).toMatchObject({
      supplier: "Supplier A",
      commissionPct: 13
    });
  });

  it("uses the cheapest duplicate within a supplier", () => {
    const result = compareAndDeduplicateHotels(
      [
        hotel("a2", "Holtin", 6200, 12),
        hotel("a1", " holtin ", 5800, 11)
      ],
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(5800);
  });

  it("handles empty arrays and ignores blank names", () => {
    expect(compareAndDeduplicateHotels([], [])).toEqual([]);
    expect(
      compareAndDeduplicateHotels([hotel("a1", "   ", 1000)], [])
    ).toEqual([]);
  });
});
