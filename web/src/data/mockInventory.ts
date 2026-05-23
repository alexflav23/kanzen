export type MockAsset = {
  id: string;
  title: string;
  maker: string;
  category: string;
  valueGbp: number;
};

// Seed data mirroring the prototype (the real Inventory wires to the F04 API later).
export const ASSETS: MockAsset[] = [
  { id: "1", title: "Royal Oak", maker: "Audemars Piguet", category: "Watches", valueGbp: 42000 },
  { id: "2", title: "La Colombe", maker: "Picasso", category: "Art", valueGbp: 92000 },
  { id: "3", title: "Les Paul Standard", maker: "Gibson", category: "Guitars", valueGbp: 4200 },
  { id: "4", title: "Tumblers ×6", maker: "Riedel", category: "Glassware", valueGbp: 180 },
];

export const CATEGORIES = ["All", "Watches", "Art", "Guitars", "Glassware"] as const;
