import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../src/app";
import { startHotelOfferWorkflow } from "../src/temporal/client";

vi.mock("../src/temporal/client", () => ({
  startHotelOfferWorkflow: vi.fn()
}));

describe("Phase 6: complete API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array when no hotels match", async () => {
    vi.mocked(startHotelOfferWorkflow).mockResolvedValueOnce([]);

    const response = await request(app).get("/api/hotels?city=unknown");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns a consistent error for missing city", async () => {
    const response = await request(app).get("/api/hotels");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "INVALID_REQUEST",
      error: "city query parameter is required"
    });
  });

  it("returns a supplier-unavailable error", async () => {
    vi.mocked(startHotelOfferWorkflow).mockRejectedValueOnce(
      new Error("SUPPLIER_FAILURE: HTTP 503")
    );

    const response = await request(app).get("/api/hotels?city=delhi");

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      code: "SUPPLIER_UNAVAILABLE",
      error: "A hotel supplier is unavailable"
    });
  });

  it("returns a Redis-unavailable error", async () => {
    vi.mocked(startHotelOfferWorkflow).mockRejectedValueOnce(
      new Error("REDIS_FAILURE: connection refused")
    );

    const response = await request(app).get("/api/hotels?city=delhi");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: "REDIS_UNAVAILABLE",
      error: "Hotel offer storage is unavailable"
    });
  });

  it("returns a timeout error", async () => {
    vi.mocked(startHotelOfferWorkflow).mockRejectedValueOnce(
      new Error("Workflow execution timed out")
    );

    const response = await request(app).get("/api/hotels?city=delhi");

    expect(response.status).toBe(504);
    expect(response.body).toEqual({
      code: "WORKFLOW_TIMEOUT",
      error: "Hotel offer workflow timed out"
    });
  });

  it("returns a generic workflow error without exposing internals", async () => {
    vi.mocked(startHotelOfferWorkflow).mockRejectedValueOnce(
      new Error("internal stack details")
    );

    const response = await request(app).get("/api/hotels?city=delhi");

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      code: "WORKFLOW_FAILED",
      error: "Unable to orchestrate hotel offers"
    });
  });
});
