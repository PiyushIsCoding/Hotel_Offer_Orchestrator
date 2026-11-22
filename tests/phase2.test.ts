import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { supplierAHotels, supplierBHotels } from "../src/suppliers/supplierData";

type SupplierHotel = {
  name: string;
  price: number;
  commissionPct: number;
};

const normalizeName = (name: string) => name.trim().toLowerCase();

describe("Phase 2: Mock supplier APIs", () => {
  describe.each([
    ["/supplierA/hotels", "Supplier A"],
    ["/supplierB/hotels", "Supplier B"],
  ])("%s (%s)", (endpoint) => {
    it("returns HTTP 400 when city is missing", async () => {
      const response = await request(app).get(endpoint);
      expect(response.status).toBe(400);
    });

    it("returns an array for Delhi", async () => {
      const response = await request(app).get(`${endpoint}?city=delhi`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("returns valid hotel records", async () => {
      const response = await request(app).get(`${endpoint}?city=delhi`);
      expect(response.status).toBe(200);

      for (const hotel of response.body as SupplierHotel[]) {
        expect(typeof hotel.name).toBe("string");
        expect(hotel.name.trim().length).toBeGreaterThan(0);
        expect(typeof hotel.price).toBe("number");
        expect(Number.isFinite(hotel.price)).toBe(true);
        expect(hotel.price).toBeGreaterThan(0);
        expect(typeof hotel.commissionPct).toBe("number");
        expect(hotel.commissionPct).toBeGreaterThanOrEqual(0);
        expect(hotel.commissionPct).toBeLessThanOrEqual(100);
      }
    });

    it("returns an empty array for an unsupported city", async () => {
      const response = await request(app).get(
        `${endpoint}?city=city-that-does-not-exist`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  it("has overlapping hotel names between the two Delhi datasets", async () => {
    const [a, b] = await Promise.all([
      request(app).get("/supplierA/hotels?city=delhi"),
      request(app).get("/supplierB/hotels?city=delhi"),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const namesB = new Set(
      (b.body as SupplierHotel[]).map((hotel) => normalizeName(hotel.name))
    );
    const overlap = (a.body as SupplierHotel[]).filter((hotel) =>
      namesB.has(normalizeName(hotel.name))
    );

    expect(overlap.length).toBeGreaterThan(0);
  });

  it("includes supplier-exclusive hotel names", async () => {
    const [a, b] = await Promise.all([
      request(app).get("/supplierA/hotels?city=delhi"),
      request(app).get("/supplierB/hotels?city=delhi"),
    ]);

    const namesA = new Set(
      (a.body as SupplierHotel[]).map((hotel) => normalizeName(hotel.name))
    );
    const namesB = new Set(
      (b.body as SupplierHotel[]).map((hotel) => normalizeName(hotel.name))
    );

    const onlyA = [...namesA].filter((name) => !namesB.has(name));
    const onlyB = [...namesB].filter((name) => !namesA.has(name));

    expect(onlyA.length + onlyB.length).toBeGreaterThan(0);
  });

  it("provides cheaper, equal, and alternate shared offers", () => {
    const supplierBByName = new Map(
      supplierBHotels
        .filter((hotel) => hotel.city === "delhi")
        .map((hotel) => [hotel.name, hotel])
    );
    const comparisons = supplierAHotels
      .filter((hotel) => hotel.city === "delhi")
      .map((hotel) => {
        const supplierB = supplierBByName.get(hotel.name);
        return supplierB ? hotel.price - supplierB.price : undefined;
      })
      .filter((difference): difference is number => difference !== undefined);

    expect(comparisons.some((difference) => difference > 0)).toBe(true);
    expect(comparisons.some((difference) => difference === 0)).toBe(true);
    expect(comparisons.some((difference) => difference < 0)).toBe(true);
  });
});
