export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
  address?: string;
  starRating?: number;
  latitude?: number;
  longitude?: number;
}

export type SupplierName = "Supplier A" | "Supplier B";

export interface SupplierOffer extends SupplierHotel {
  supplier: SupplierName;
}

export interface ConsolidatedHotel {
  name: string;
  price: number;
  supplier: SupplierName;
  commissionPct: number;
  alternateOffers?: SupplierOffer[];
}

export interface HotelWorkflowInput {
  city: string;
  minPrice?: number;
  maxPrice?: number;
  checkIn?: string;
  checkOut?: string;
  refresh?: boolean;
}

export interface HotelCacheMetadata {
  city: string;
  checkIn?: string;
  checkOut?: string;
  refreshedAt: string;
  expiresAt: string;
  recordCount: number;
}
