export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

export interface ConsolidatedHotel {
  name: string;
  price: number;
  supplier: "Supplier A" | "Supplier B";
  commissionPct: number;
}

export interface HotelWorkflowInput {
  city: string;
  minPrice?: number;
  maxPrice?: number;
}
