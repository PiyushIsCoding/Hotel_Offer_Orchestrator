import { SupplierHotel } from "../types/hotel";

const cities = [
  "delhi",
  "mumbai",
  "goa",
  "bangalore",
  "jaipur",
  "chennai",
  "kolkata",
  "hyderabad"
];

const sharedHotelNames = [
  "Holtin",
  "Radison",
  "The Imperial",
  "Leela Palace",
  "Taj Lands End",
  "ITC Maurya",
  "The Grand",
  "Westin",
  "Novotel",
  "Marriott",
  "Hilton",
  "Hyatt",
  "Holiday Inn",
  "Sheraton",
  "Four Seasons",
  "Oberoi",
  "Ritz Carlton",
  "JW Marriott",
  "Crowne Plaza",
  "DoubleTree",
  "Renaissance",
  "Mercure",
  "Sofitel",
  "Pullman",
  "Keys Hotel",
  "Sterling",
  "Royal Orchid",
  "Zone by The Park",
  "Fortune Park",
  "Radisson Blu",
  "Courtyard",
  "Vivanta",
  "MGM",
  "Swissotel",
  "Anantara",
  "Ascott",
  "Dusit",
  "Fairmont",
  "Banyan Tree",
  "Andaz"
];

const supplierAOnlyNames = [
  "The Orchid",
  "FabHotel Prime",
  "Lemon Tree",
  "Sarovar Portico",
  "Clarks Inn",
  "Country Inn",
  "Bloom Hotel",
  "Urban Stay",
  "Golden Tulip",
  "Hotel Regent",
  "Premium Inn",
  "Central Suites"
];

const supplierBOnlyNames = [
  "Aurika",
  "Ibis",
  "The Park",
  "Ginger",
  "ibis Styles",
  "Eros Hotel",
  "Hometel",
  "Grand Mercure",
  "Iconic Hotel",
  "Riverfront Stay",
  "Cityscape Hotel",
  "Azure Residency"
];

function buildHotels(
  prefix: "a" | "b",
  exclusiveNames: string[],
  priceOffset: number
): SupplierHotel[] {
  const hotels: SupplierHotel[] = [];

  for (const city of cities) {
    const cityIndex = cities.indexOf(city);

    sharedHotelNames.forEach((name, hotelIndex) => {
      hotels.push({
        hotelId: `${prefix}${hotelIndex + 1}-${cityIndex + 1}`,
        name: cityIndex > 0 ? `${name} ${city.charAt(0).toUpperCase() + city.slice(1)}` : name,
        price: 4200 + cityIndex * 950 + hotelIndex * 230 + priceOffset,
        city,
        commissionPct: 10 + ((hotelIndex + cityIndex) % 12)
      });
    });

    exclusiveNames.forEach((name, hotelIndex) => {
      hotels.push({
        hotelId: `${prefix}x${hotelIndex + 1}-${cityIndex + 1}`,
        name: cityIndex > 0 ? `${name} ${city.charAt(0).toUpperCase() + city.slice(1)}` : name,
        price: 3600 + cityIndex * 700 + hotelIndex * 310 + priceOffset,
        city,
        commissionPct: 9 + ((hotelIndex + cityIndex) % 10)
      });
    });
  }

  return hotels;
}

export const supplierAHotels = buildHotels("a", supplierAOnlyNames, 350);
export const supplierBHotels = buildHotels("b", supplierBOnlyNames, -120);
