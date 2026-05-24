export type MockPerson = { id: string; name: string; role: string; permitDays?: number };

export const PEOPLE: MockPerson[] = [
  { id: "flavian", name: "Flavian", role: "Principal" },
  { id: "lorna", name: "Lorna", role: "Chief of Staff" },
  { id: "marcia", name: "Marcia", role: "Housekeeper · Wardian" },
  { id: "siti", name: "Siti", role: "Housekeeper · Singapore", permitDays: 50 },
];
