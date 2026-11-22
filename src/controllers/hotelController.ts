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

function parseDate(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }

  return value;
}

function parseRefresh(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "true" && value !== "false") {
    throw new Error("refresh must be true or false");
  }

  return value === "true";
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
    const checkIn = parseDate(req.query.checkIn, "checkIn");
    const checkOut = parseDate(req.query.checkOut, "checkOut");
    const refresh = parseRefresh(req.query.refresh);

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

    if (checkIn && checkOut && checkIn > checkOut) {
      res.status(400).json({
        code: "INVALID_REQUEST",
        error: "checkIn cannot be after checkOut"
      });
      return;
    }

    input = { city, minPrice, maxPrice };
    if (checkIn) {
      input.checkIn = checkIn;
    }
    if (checkOut) {
      input.checkOut = checkOut;
    }
    if (refresh !== undefined) {
      input.refresh = refresh;
    }
  } catch (error) {
    res.status(400).json({
      code: "INVALID_REQUEST",
      error: error instanceof Error ? error.message : "Invalid price filter"
    });
    return;
  }

  try {
    const hotels = await startHotelOfferWorkflow(input);
    res.status(200).json(
      hotels.map(({ name, price, supplier, commissionPct }) => ({
        name,
        price,
        supplier,
        commissionPct
      }))
    );
  } catch (error) {
    console.error("Hotel workflow failed:", error);
    const failure = getWorkflowFailure(error);
    res.status(failure.status).json({
      code: failure.code,
      error: failure.error
    });
  }
}
