// Seed data mirroring the web app exactly (web/src/data/*). Same assets,
// expenses, properties and people — the mobile companion shows identical
// content. The real screens wire to the F04/F12/F03/F10 APIs later.

class Asset {
  final String id, title, maker, category;
  final int valueGbp;
  const Asset(this.id, this.title, this.maker, this.category, this.valueGbp);
}

const assets = <Asset>[
  Asset('1', 'Royal Oak', 'Audemars Piguet', 'Watches', 42000),
  Asset('2', 'La Colombe', 'Picasso', 'Art', 92000),
  Asset('3', 'Les Paul Standard', 'Gibson', 'Guitars', 4200),
  Asset('4', 'Tumblers ×6', 'Riedel', 'Glassware', 180),
];

const categories = <String>['All', 'Watches', 'Art', 'Guitars', 'Glassware'];

enum ExpenseStatus { pending, approved, rejected }

class Expense {
  final String id, payee, description, currency, property;
  final int amountMinor;
  final ExpenseStatus status;
  const Expense(this.id, this.payee, this.description, this.amountMinor,
      this.currency, this.property, this.status);

  Expense withStatus(ExpenseStatus s) =>
      Expense(id, payee, description, amountMinor, currency, property, s);
}

const expenses = <Expense>[
  Expense('e1', 'Hudson Sandler', 'HVAC quarterly service', 184000, 'GBP', 'Wardian', ExpenseStatus.pending),
  Expense('e2', 'SG Roofing', 'Roof tile repair', 264000, 'SGD', 'Singapore', ExpenseStatus.pending),
  Expense('e3', 'Waitrose', 'Household supplies', 8400, 'GBP', 'Wardian', ExpenseStatus.approved),
];

class Property {
  final String id, name, address, jurisdiction;
  final int rooms, assets, bills, vendors;
  const Property(this.id, this.name, this.address, this.jurisdiction,
      this.rooms, this.assets, this.bills, this.vendors);
}

const properties = <Property>[
  Property('wardian', 'Wardian, Apt 5206', 'London E14', 'UK', 8, 142, 11, 6),
  Property('singapore', 'Singapore', 'Marina Bay', 'SG', 6, 38, 7, 4),
];

class Person {
  final String id, name, role;
  final int? permitDays;
  const Person(this.id, this.name, this.role, [this.permitDays]);
}

const people = <Person>[
  Person('toby', 'Toby', 'Principal'),
  Person('lorna', 'Lorna', 'Chief of Staff'),
  Person('marcia', 'Marcia', 'Housekeeper · Wardian'),
  Person('siti', 'Siti', 'Housekeeper · Singapore', 50),
];
