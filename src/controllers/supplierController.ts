import { Request, Response } from "express";
import { supplierAHotels, supplierBHotels } from "../suppliers/supplierData";
import { SupplierHotel } from "../types/hotel";

function getHotelsByCity(
  hotels: SupplierHotel[],
  city: unknown
): SupplierHotel[] {
  if (typeof city !== "string" || city.trim() === "") {
    return [];
  }

  const normalizedCity = city.trim().toLowerCase();
  return hotels.filter(
    (hotel) => hotel.city.toLowerCase() === normalizedCity
  );
}

export function getSupplierAHotels(req: Request, res: Response): void {
  const { city } = req.query;

  if (typeof city !== "string" || city.trim() === "") {
    res.status(400).json({ error: "city query parameter is required" });
    return;
  }

  res.json(getHotelsByCity(supplierAHotels, city));
}

export function getSupplierBHotels(req: Request, res: Response): void {
  const { city } = req.query;

  if (typeof city !== "string" || city.trim() === "") {
    res.status(400).json({ error: "city query parameter is required" });
    return;
  }

  res.json(getHotelsByCity(supplierBHotels, city));
}
