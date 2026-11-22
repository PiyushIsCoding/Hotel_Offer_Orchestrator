import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../src/app";
import { fetchSupplierA, fetchSupplierB } from "../src/temporal/activities";
import { startHotelOfferWorkflow } from "../src/temporal/client";

vi.mock("../src/temporal/client", () => ({
  startHotelOfferWorkflow: vi.fn()
}));

describe("Phase 4: Temporal integration boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts the workflow with a normalized city and price filters", async () => {
    vi.mocked(startHotelOfferWorkflow).mockResolvedValueOnce([]);

    const response = await request(app).get(
      "/api/hotels?city=%20Delhi%20&minPrice=5000&maxPrice=7000"
    );

    expect(response.status).toBe(200);
    expect(startHotelOfferWorkflow).toHaveBeenCalledWith({
      city: "Delhi",
      minPrice: 5000,
      maxPrice: 7000
    });
  });

  it("returns 502 when the Temporal workflow fails", async () => {
    vi.mocked(startHotelOfferWorkflow).mockRejectedValueOnce(
      new Error("Temporal unavailable")
    );

    const response = await request(app).get("/api/hotels?city=delhi");

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("Unable to orchestrate hotel offers");
  });

  it("rejects malformed, negative, and reversed price filters", async () => {
    for (const query of [
      "minPrice=not-a-number",
      "minPrice=-1",
      "minPrice=7000&maxPrice=5000"
    ]) {
      const response = await request(app).get(`/api/hotels?city=delhi&${query}`);
      expect(response.status).toBe(400);
    }

    expect(startHotelOfferWorkflow).not.toHaveBeenCalled();
  });

  it("propagates successful supplier activity responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ hotelId: "a1", name: "Hotel A" }]
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSupplierA("delhi")).resolves.toHaveLength(1);
    await expect(fetchSupplierB("delhi")).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails supplier activities on HTTP errors and invalid payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );

    await expect(fetchSupplierA("delhi")).rejects.toThrow("HTTP 503");
    await expect(fetchSupplierB("delhi")).rejects.toThrow("invalid response");
  });
});
