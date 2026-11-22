import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("Phase 1: Backend foundation", () => {
  it("creates the Express application", () => {
    expect(app).toBeDefined();
  });

  it("returns HTTP 200 from GET /health", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
  });

  it("returns a healthy status payload", async () => {
    const response = await request(app).get("/health");
    expect(response.body).toMatchObject({ status: "ok" });
  });
});
