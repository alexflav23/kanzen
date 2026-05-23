// Property seed data — mirrors input/views/properties.jsx (list + "bible").

export type Room = { id: string; name: string; floor: string; area: string; assets: number };
export type PropDoc = { name: string; category: string; access: string; expiry: string };
export type Linked = { todoist: string; calendar: string; drive: string; vault: string };

export type MockProperty = {
  id: "wardian" | "singapore";
  name: string;
  address: string;
  jurisdiction: string;
  ownership: string;
  type: string;
  buildingMgmt: string;
  cover: string; // gradient
  rooms: number;
  assets: number;
  bills: number;
  vendors: number;
  pendingDefects: number;
  linked: Linked;
};

export const PROPERTIES: MockProperty[] = [
  {
    id: "wardian", name: "Wardian, Apt 5206", address: "London E14", jurisdiction: "UK",
    ownership: "Owned", type: "Apartment", buildingMgmt: "Ballymore Estate Mgmt",
    cover: "linear-gradient(135deg,#1B1F2E,#3B3F55)", rooms: 8, assets: 142, bills: 11, vendors: 6, pendingDefects: 2,
    linked: { todoist: "Wardian", calendar: "wardian@household.cal", drive: "/Properties/Wardian", vault: "Wardian" },
  },
  {
    id: "singapore", name: "Singapore", address: "Marina Bay", jurisdiction: "SG",
    ownership: "Owned", type: "Condominium", buildingMgmt: "Marina Bay MCST",
    cover: "linear-gradient(135deg,#243B47,#3D6B7D)", rooms: 6, assets: 38, bills: 7, vendors: 4, pendingDefects: 1,
    linked: { todoist: "Singapore", calendar: "sg@household.cal", drive: "/Properties/Singapore", vault: "Singapore" },
  },
];

export const ROOMS: Record<string, Room[]> = {
  wardian: [
    { id: "liv", name: "Living room", floor: "52", area: "42 m²", assets: 8 },
    { id: "study", name: "Study", floor: "52", area: "18 m²", assets: 12 },
    { id: "kit", name: "Kitchen", floor: "52", area: "20 m²", assets: 6 },
    { id: "mbr", name: "Master bedroom", floor: "52", area: "30 m²", assets: 5 },
    { id: "music", name: "Music room", floor: "52", area: "16 m²", assets: 3 },
  ],
  singapore: [
    { id: "liv", name: "Living room", floor: "18", area: "38 m²", assets: 6 },
    { id: "cellar", name: "Wine cellar", floor: "B1", area: "12 m²", assets: 4 },
    { id: "hall", name: "Hallway", floor: "18", area: "10 m²", assets: 3 },
  ],
};

export const PROP_DOCS: Record<string, PropDoc[]> = {
  wardian: [
    { name: "Lease & deeds.pdf", category: "Legal", access: "Principal", expiry: "—" },
    { name: "Buildings insurance 2026.pdf", category: "Insurance", access: "Principal · Manager", expiry: "30 Jun 2026" },
    { name: "EPC certificate.pdf", category: "Compliance", access: "All", expiry: "—" },
  ],
  singapore: [
    { name: "TOP & strata title.pdf", category: "Legal", access: "Principal", expiry: "—" },
    { name: "Fire safety cert.pdf", category: "Compliance", access: "Principal · Manager", expiry: "10 May 2026" },
    { name: "Condo insurance 2026.pdf", category: "Insurance", access: "Principal", expiry: "31 Mar 2027" },
  ],
};
