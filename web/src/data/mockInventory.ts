// Inventory seed data — mirrors input/views/assets.jsx (+ data-inventory.jsx,
// which wasn't in the download; reconstructed). Real screens wire to F04 later.

export type AssetMode = "single" | "grouped-quantity" | "structured-set";
export type AssetCondition = "Excellent" | "Good" | "Fair" | "Service";

export type MockAsset = {
  id: string;
  title: string;
  maker: string;
  category: string; // category id
  currency: string;
  current: number; // current value (whole units, like the prototype)
  insured: number;
  propId: "wardian" | "singapore";
  sub: string; // location within property
  status: "Owned" | "Sold" | "Gifted" | "Lost" | "Stolen" | "Archived";
  condition: AssetCondition;
  acquired: string;
  tags: string[];
  mode: AssetMode;
  qty?: number;
  fill: string; // photo placeholder gradient
};

export const ASSETS: MockAsset[] = [
  { id: "1", title: "Royal Oak", maker: "Audemars Piguet", category: "watches", currency: "GBP", current: 42000, insured: 45000, propId: "wardian", sub: "Study safe", status: "Owned", condition: "Excellent", acquired: "2019-06-12", tags: ["heirloom"], mode: "single", fill: "linear-gradient(135deg,#1B1F2E,#3B3F55)" },
  { id: "2", title: "Nautilus 5711", maker: "Patek Philippe", category: "watches", currency: "GBP", current: 78000, insured: 80000, propId: "wardian", sub: "Study safe", status: "Owned", condition: "Excellent", acquired: "2021-03-02", tags: ["insured"], mode: "single", fill: "linear-gradient(135deg,#2A2A2A,#4A4A4A)" },
  { id: "3", title: "La Colombe", maker: "Picasso (lithograph)", category: "art", currency: "GBP", current: 92000, insured: 95000, propId: "wardian", sub: "Living room", status: "Owned", condition: "Good", acquired: "2018-11-20", tags: ["insured"], mode: "single", fill: "linear-gradient(135deg,#3A2E2A,#6B5446)" },
  { id: "4", title: "Untitled, 1994", maker: "Howard Hodgkin", category: "art", currency: "GBP", current: 24000, insured: 24000, propId: "singapore", sub: "Hallway", status: "Owned", condition: "Good", acquired: "2020-07-01", tags: [], mode: "single", fill: "linear-gradient(135deg,#243B47,#3D6B7D)" },
  { id: "5", title: "Les Paul Standard", maker: "Gibson", category: "guitars", currency: "GBP", current: 4200, insured: 4000, propId: "wardian", sub: "Music room", status: "Owned", condition: "Service", acquired: "2017-02-14", tags: ["vintage"], mode: "single", fill: "linear-gradient(135deg,#3a2f1a,#6b5836)" },
  { id: "6", title: "Tumblers ×6", maker: "Riedel", category: "glassware", currency: "GBP", current: 180, insured: 0, propId: "wardian", sub: "Kitchen", status: "Owned", condition: "Good", acquired: "2022-09-10", tags: [], mode: "grouped-quantity", qty: 6, fill: "linear-gradient(135deg,#2e3a3a,#566b6b)" },
  { id: "7", title: "Château Margaux 2015", maker: "Bordeaux", category: "wine", currency: "GBP", current: 5400, insured: 0, propId: "singapore", sub: "Cellar", status: "Owned", condition: "Excellent", acquired: "2019-10-05", tags: ["cellar"], mode: "grouped-quantity", qty: 12, fill: "linear-gradient(135deg,#3a1a24,#6b3648)" },
  { id: "8", title: "Eames Lounge & Ottoman", maker: "Herman Miller", category: "furniture", currency: "GBP", current: 6800, insured: 6000, propId: "wardian", sub: "Study", status: "Owned", condition: "Good", acquired: "2016-05-30", tags: [], mode: "structured-set", fill: "linear-gradient(135deg,#2a2a2e,#4a4a55)" },
];

export type Category = { id: string; name: string; parent?: string; count: number };
export const CATEGORIES: Category[] = [
  { id: "watches", name: "Watches", count: 2 },
  { id: "art", name: "Art", count: 2 },
  { id: "instruments", name: "Instruments", count: 1 },
  { id: "guitars", name: "Guitars", parent: "instruments", count: 1 },
  { id: "glassware", name: "Glassware", count: 1 },
  { id: "wine", name: "Wine", count: 1 },
  { id: "furniture", name: "Furniture", count: 1 },
];

export const STATUSES = ["Owned", "Sold", "Gifted", "Lost", "Stolen", "Archived"] as const;
export const ALL_TAGS = Array.from(new Set(ASSETS.flatMap((a) => a.tags)));

export const ASSET_TOTAL = 180; // Wardian 142 + Singapore 38
export const TOTAL_COMPLETENESS = 0.86;
export const DATA_QUALITY = { missingPhoto: 8, missingLocation: 0, missingProof: 3, expensiveMissingProof: 1, suspectedDuplicates: 1 };

export function fmtMoneyShort(n: number, currency = "GBP"): string {
  const sym = currency === "GBP" ? "£" : currency === "SGD" ? "S$" : currency + " ";
  if (n >= 1000) return `${sym}${Math.round(n / 1000)}k`;
  return `${sym}${n.toLocaleString("en-GB")}`;
}

export function categoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}
export function propName(id: string): string {
  return id === "wardian" ? "Wardian, Apt 5206" : "Singapore";
}
