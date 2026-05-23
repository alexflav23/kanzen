export type MockProperty = {
  id: string;
  name: string;
  address: string;
  jurisdiction: string;
  rooms: number;
  assets: number;
  bills: number;
  vendors: number;
};

export const PROPERTIES: MockProperty[] = [
  { id: "wardian", name: "Wardian, Apt 5206", address: "London E14", jurisdiction: "UK", rooms: 8, assets: 142, bills: 11, vendors: 6 },
  { id: "singapore", name: "Singapore", address: "Marina Bay", jurisdiction: "SG", rooms: 6, assets: 38, bills: 7, vendors: 4 },
];
