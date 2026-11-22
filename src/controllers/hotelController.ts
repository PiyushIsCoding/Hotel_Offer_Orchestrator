import { Request, Response } from "express";
import { startHotelOfferWorkflow } from "../temporal/client";
import { HotelWorkflowInput } from "../types/hotel";

function parsePrice(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Prices must be valid numbers");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Prices must be valid non-negative numbers");
  }

  return parsed;
}

function getWorkflowFailure(error: unknown): {
  status: number;
  code: string;
  error: string;
} {
  const message = error instanceof Error ? error.message : "";

  if (/timeout|timed out/i.test(message)) {
    return {
      status: 504,
      code: "WORKFLOW_TIMEOUT",
      error: "Hotel offer workflow timed out"
    };
  }

  if (message.includes("REDIS_FAILURE")) {
    return {
      status: 503,
      code: "REDIS_UNAVAILABLE",
      error: "Hotel offer storage is unavailable"
    };
  }

  if (message.includes("SUPPLIER_FAILURE")) {
    return {
      status: 502,
      code: "SUPPLIER_UNAVAILABLE",
      error: "A hotel supplier is unavailable"
    };
  }

  return {
    status: 502,
    code: "WORKFLOW_FAILED",
    error: "Unable to orchestrate hotel offers"
  };
}

export async function getHotels(req: Request, res: Response): Promise<void> {
  const city = typeof req.query.city === "string"
    ? req.query.city.trim()
    : "";

  if (!city) {
    res.status(400).json({
      code: "INVALID_REQUEST",
      error: "city query parameter is required"
    });
    return;
  }

  let input: HotelWorkflowInput;
  try {
    const minPrice = parsePrice(req.query.minPrice);
    const maxPrice = parsePrice(req.query.maxPrice);

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      res.status(400).json({
        code: "INVALID_REQUEST",
        error: "minPrice cannot be greater than maxPrice"
      });
      return;
    }

    input = { city, minPrice, maxPrice };
  } catch (error) {
    res.status(400).json({
      code: "INVALID_REQUEST",
      error: error instanceof Error ? error.message : "Invalid price filter"
    });
    return;
  }

  try {
    const hotels = await startHotelOfferWorkflow(input);
    res.status(200).json(hotels);
  } catch (error) {
    console.error("Hotel workflow failed:", error);
    const failure = getWorkflowFailure(error);
    res.status(failure.status).json({
      code: failure.code,
      error: failure.error
    });
  }
}
