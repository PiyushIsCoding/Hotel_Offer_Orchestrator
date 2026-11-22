import assert from "node:assert/strict";
import test from "node:test";
import { SupplierHotel } from "../types/hotel";
import {
  compareAndDeduplicateHotels,
  normalizeHotelName
} from "./hotelComparisonService";

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

test("normalizes whitespace and casing", () => {
  assert.equal(normalizeHotelName("  The   Grand  "), "the grand");
});

test("selects the cheaper overlapping hotel", () => {
  const result = compareAndDeduplicateHotels(
    [hotel("a1", "Holtin", 6000, 10)],
    [hotel("b1", "Holtin", 5340, 20)]
  );

  assert.deepEqual(result, [
    {
      name: "Holtin",
      price: 5340,
      supplier: "Supplier B",
      commissionPct: 20
    }
  ]);
});

test("retains supplier-only hotels", () => {
  const result = compareAndDeduplicateHotels(
    [hotel("a1", "Hotel A", 5000)],
    [hotel("b1", "Hotel B", 7000)]
  );

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.supplier), [
    "Supplier A",
    "Supplier B"
  ]);
});

test("uses Supplier A deterministically for equal prices", () => {
  const result = compareAndDeduplicateHotels(
    [hotel("a1", "Radison", 5900, 13)],
    [hotel("b1", "Radison", 5900, 18)]
  );

  assert.equal(result[0].supplier, "Supplier A");
  assert.equal(result[0].commissionPct, 13);
});

test("selects the cheapest duplicate within a supplier", () => {
  const result = compareAndDeduplicateHotels(
    [
      hotel("a2", "  HoltIn ", 6200, 12),
      hotel("a1", "Holtin", 5800, 11)
    ],
    []
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].price, 5800);
  assert.equal(result[0].commissionPct, 11);
});

test("handles empty supplier responses", () => {
  assert.deepEqual(compareAndDeduplicateHotels([], []), []);
  assert.equal(
    compareAndDeduplicateHotels([hotel("a1", "Hotel A", 5000)], []).length,
    1
  );
});

test("matches hotel names without affecting the name casing", () => {
  const result = compareAndDeduplicateHotels(
    [hotel("a1", "  THE   GRAND ", 7100)],
    [hotel("b1", "the grand", 6900)]
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].supplier, "Supplier B");
  assert.equal(result[0].name, "the grand");
});
