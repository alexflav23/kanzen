// Kanzen seed data
const DATA = {
  user: {
    name: "Lorna",
    initials: "L",
    role: "Chief of Staff",
    email: "lorna@kanzen.family",
  },
  properties: [
    {
      id: "wardian",
      name: "Wardian",
      address: "Apt 5206, Wardian London, E14 9HF",
      type: "Apartment",
      ownership: "Owned",
      jurisdiction: "UK",
      buildingMgmt: "Ballymore Asset Management",
      cover: "wardian",
      todoistProjectId: "todoist://2294001234",
      driveFolderId: "drive://wardian-5206",
      calendarId: "house@kanzen.family",
      vault: "1P: Wardian",
      rooms: 5,
      assets: 38,
      bills: 9,
      vendors: 14,
      pendingDefects: 2,
    },
    {
      id: "singapore",
      name: "Singapore",
      address: "12 Cluny Park Road, 259597, Singapore",
      type: "House",
      ownership: "Leased",
      jurisdiction: "SG",
      buildingMgmt: "—",
      cover: "singapore",
      todoistProjectId: "todoist://2294005678",
      driveFolderId: "drive://singapore-cluny",
      calendarId: "house@kanzen.family",
      vault: "1P: Singapore",
      rooms: 9,
      assets: 67,
      bills: 12,
      vendors: 9,
      pendingDefects: 1,
    },
  ],
  people: [
    { id: "lorna", name: "Lorna Bridge", role: "Chief of Staff", initials: "LB", color: "#5856D6" },
    { id: "marcia", name: "Marcia Almeida Pereira Coomber", role: "Housekeeper · Wardian", initials: "MP", color: "#34C759" },
    { id: "siti", name: "Siti Rahmat", role: "Housekeeper · Singapore", initials: "SR", color: "#FF9F0A" },
    { id: "principal", name: "Flavian", role: "Principal", initials: "F", color: "#4F46E5" },
  ],
  bills: [
    { id: "b1", payee: "Octopus Energy", category: "Utilities", property: "wardian", amount: 218.40, currency: "GBP", freq: "Monthly", method: "Direct Debit · Coutts", nextDue: "2026-06-04", lastSeen: 218.40, prevSeen: 205.10, variance: false, lead: 5 },
    { id: "b2", payee: "Thames Water", category: "Utilities", property: "wardian", amount: 64.12, currency: "GBP", freq: "Monthly", method: "Direct Debit · Coutts", nextDue: "2026-06-12", lastSeen: 64.12, prevSeen: 61.50, variance: false, lead: 5 },
    { id: "b3", payee: "Hyperoptic", category: "Internet", property: "wardian", amount: 45.00, currency: "GBP", freq: "Monthly", method: "Card · Amex Platinum", nextDue: "2026-06-01", lastSeen: 45.00, prevSeen: 45.00, variance: false, lead: 3 },
    { id: "b4", payee: "Ballymore Service Charge", category: "Property", property: "wardian", amount: 4280.00, currency: "GBP", freq: "Quarterly", method: "Bank Transfer · Coutts", nextDue: "2026-07-01", lastSeen: 4280, prevSeen: 4280, variance: false, lead: 14 },
    { id: "b5", payee: "Bupa Health", category: "Insurance", property: "wardian", amount: 412.55, currency: "GBP", freq: "Monthly", method: "Direct Debit · Coutts", nextDue: "2026-06-15", lastSeen: 412.55, prevSeen: 412.55, variance: false, lead: 7 },
    { id: "b6", payee: "SP Group", category: "Utilities", property: "singapore", amount: 612.80, currency: "SGD", freq: "Monthly", method: "GIRO", nextDue: "2026-06-08", lastSeen: 612.80, prevSeen: 384.20, variance: true, lead: 5 },
    { id: "b7", payee: "Singtel Fibre", category: "Internet", property: "singapore", amount: 88.00, currency: "SGD", freq: "Monthly", method: "Card · Amex", nextDue: "2026-06-05", lastSeen: 88.00, prevSeen: 88.00, variance: false, lead: 3 },
    { id: "b8", payee: "Pool & Garden Co.", category: "Maintenance", property: "singapore", amount: 480.00, currency: "SGD", freq: "Monthly", method: "Bank Transfer", nextDue: "2026-06-20", lastSeen: 480, prevSeen: 480, variance: false, lead: 5 },
    { id: "b9", payee: "Cluny Park Lease", category: "Property", property: "singapore", amount: 28000.00, currency: "SGD", freq: "Quarterly", method: "Bank Transfer", nextDue: "2026-08-01", lastSeen: 28000, prevSeen: 28000, variance: false, lead: 21 },
  ],
  expenses: [
    { id: "e1", date: "2026-05-19", payee: "John Lewis", desc: "Replacement Dyson V15", amount: 749.99, currency: "GBP", property: "wardian", category: "Household", status: "Approved", approver: "principal" },
    { id: "e2", date: "2026-05-20", payee: "BCS Cleaning", desc: "Deep clean — guest visit", amount: 320.00, currency: "GBP", property: "wardian", category: "Cleaning", status: "Approved", approver: "principal" },
    { id: "e3", date: "2026-05-21", payee: "Hudson Sandler", desc: "Q2 annual maintenance — HVAC", amount: 1840.00, currency: "GBP", property: "wardian", category: "Maintenance", status: "Pending Approval", approver: "principal", requested: "Lorna" },
    { id: "e4", date: "2026-05-22", payee: "Tan Hardware", desc: "Roof tile repair — emergency", amount: 2640.00, currency: "SGD", property: "singapore", category: "Maintenance", status: "Pending Approval", approver: "principal", requested: "Lorna" },
    { id: "e5", date: "2026-05-15", payee: "Waitrose", desc: "Weekly groceries", amount: 184.20, currency: "GBP", property: "wardian", category: "Household", status: "Approved", approver: "principal" },
  ],
  vendors: [
    { id: "v1", name: "Hudson Sandler", trade: "HVAC & Mechanical", properties: ["wardian"], ndaUntil: "2027-03-12", insuranceUntil: "2026-12-01", rating: 4.8, contact: "ops@hudsonsandler.co.uk" },
    { id: "v2", name: "BCS Cleaning", trade: "Housekeeping", properties: ["wardian"], ndaUntil: "2026-06-30", insuranceUntil: "2026-09-01", rating: 4.6, contact: "bookings@bcs.co.uk", warning: "NDA renewal in 38 days" },
    { id: "v3", name: "Pool & Garden Co.", trade: "Landscaping", properties: ["singapore"], ndaUntil: "2027-01-08", insuranceUntil: "2026-10-15", rating: 4.9, contact: "service@poolgardensg.com" },
    { id: "v4", name: "Tan Hardware", trade: "General Contractor", properties: ["singapore"], ndaUntil: "2026-11-30", insuranceUntil: "2026-08-04", rating: 4.4, contact: "info@tanhardware.sg" },
    { id: "v5", name: "Aria Floral", trade: "Florist", properties: ["wardian", "singapore"], ndaUntil: "2027-04-20", insuranceUntil: "—", rating: 4.9, contact: "studio@aria.london" },
  ],
  rooms: {
    wardian: [
      { id: "r1", name: "Master Bedroom", floor: "52", area: "28 m²", assets: 8 },
      { id: "r2", name: "Principal Office", floor: "52", area: "18 m²", assets: 11 },
      { id: "r3", name: "Living Room", floor: "52", area: "42 m²", assets: 14 },
      { id: "r4", name: "Kitchen", floor: "52", area: "16 m²", assets: 18 },
      { id: "r5", name: "Guest Suite", floor: "52", area: "22 m²", assets: 9 },
    ],
  },
  assets: {
    wardian: [
      { id: "a1", name: "Gaggenau 200 Series Oven", room: "r4", category: "Appliance", serial: "BO420112-AC", purchased: "2023-08-12", warranty: "2028-08-12", lastService: "2025-11-04" },
      { id: "a2", name: "Sub-Zero ICBBI-36U Fridge", room: "r4", category: "Appliance", serial: "SZ-9921104", purchased: "2023-08-12", warranty: "2028-08-12", lastService: "2025-10-22" },
      { id: "a3", name: "Daikin VRV-IV HVAC", room: "—", category: "Building Systems", serial: "DK-VRV-2206", purchased: "2023-07-01", warranty: "2030-07-01", lastService: "2026-02-19" },
      { id: "a4", name: "Sonos Architectural × 8", room: "r3", category: "AV", serial: "—", purchased: "2023-09-04", warranty: "2025-09-04", lastService: "—" },
      { id: "a5", name: "Lutron RA3 Lighting", room: "r3", category: "Building Systems", serial: "RA3-2399-AZ", purchased: "2023-07-22", warranty: "2028-07-22", lastService: "2026-01-15" },
      { id: "a6", name: "Roca Inspira Bathroom", room: "r1", category: "Fixture", serial: "—", purchased: "2023-07-30", warranty: "2030-07-30", lastService: "—" },
    ],
  },
  maintenancePlans: [
    { id: "m1", asset: "a3", assetName: "Daikin VRV-IV HVAC", property: "wardian", vendor: "Hudson Sandler", freq: "Quarterly", nextDue: "2026-05-28", lead: 14, expectedCost: 1840, currency: "GBP" },
    { id: "m2", asset: "a1", assetName: "Gaggenau 200 Oven", property: "wardian", vendor: "Hudson Sandler", freq: "Annually", nextDue: "2026-08-12", lead: 21, expectedCost: 320, currency: "GBP" },
    { id: "m3", asset: "a5", assetName: "Lutron RA3 Lighting", property: "wardian", vendor: "Hudson Sandler", freq: "Semi-annually", nextDue: "2026-07-22", lead: 14, expectedCost: 480, currency: "GBP" },
    { id: "m4", asset: "—", assetName: "Pool · Filter service", property: "singapore", vendor: "Pool & Garden Co.", freq: "Monthly", nextDue: "2026-06-04", lead: 5, expectedCost: 480, currency: "SGD" },
  ],
  // Agent Triage queue — what's awaiting human review
  triage: [
    {
      id: "t1",
      received: "2026-05-22T08:14:00Z",
      mailbox: "deliveries@kanzen.family",
      sender: "no-reply@waitrose.com",
      subject: "Your Waitrose delivery is on its way — Tuesday 26 May, 11:00–12:00",
      category: "Delivery",
      confidence: 0.97,
      extracted: {
        property: "Wardian",
        carrier: "Waitrose",
        item: "Grocery order #WTR-883124",
        window: "Tue 26 May, 11:00–12:00",
        tracking: "WTR-883124",
      },
      proposedActions: [
        { type: "create_task", target: "Todoist · Wardian", title: "Receive Waitrose delivery (11:00–12:00)", assignee: "Marcia" },
        { type: "create_event", target: "Google Calendar", title: "Waitrose delivery window", time: "Tue 26 May · 11:00–12:00" },
      ],
      bodyExcerpt: "Hi Flavian,\n\nYour delivery is on its way and will arrive between 11:00 and 12:00 on Tuesday 26 May.\n\nOrder ref: WTR-883124\nDelivering to: Apt 5206, Wardian, E14 9HF\n\nIf you need to make changes please log into your account.",
    },
    {
      id: "t2",
      received: "2026-05-22T07:42:00Z",
      mailbox: "accounts@kanzen.family",
      sender: "billing@spgroup.com.sg",
      subject: "SP Group — May statement available · S$612.80",
      category: "Bill / Invoice",
      confidence: 0.92,
      extracted: {
        payee: "SP Group",
        amount: "S$612.80",
        currency: "SGD",
        dueDate: "2026-06-08",
        account: "Singapore · Cluny Park",
        property: "Singapore",
        previous: "S$384.20",
      },
      proposedActions: [
        { type: "reconcile_bill", target: "Bills · SP Group", title: "Update next due + amount", note: "Variance: +59.6% vs last month" },
        { type: "file_document", target: "Drive · Singapore / Statements / 2026", title: "SP Group · May 2026 statement.pdf" },
      ],
      varianceFlag: true,
      bodyExcerpt: "Dear Customer,\n\nYour May 2026 statement is now available.\n\nAccount: 8801-2241-99\nAmount due: S$612.80\nDue by: 8 June 2026\n\nUsage this period is 62% higher than the previous month.",
    },
    {
      id: "t3",
      received: "2026-05-21T16:20:00Z",
      mailbox: "house@kanzen.family",
      sender: "concierge@thedorchester.com",
      subject: "Reservation confirmed · Dinner for 4, 28 May 19:30",
      category: "Booking",
      confidence: 0.95,
      extracted: {
        venue: "The Dorchester · Grill",
        date: "2026-05-28",
        time: "19:30",
        party: "4 guests",
        reference: "DC-4471",
      },
      proposedActions: [
        { type: "create_event", target: "Google Calendar", title: "Dinner — The Dorchester (4)", time: "Thu 28 May · 19:30" },
      ],
      bodyExcerpt: "Dear Mr Kanzen,\n\nWe are delighted to confirm your reservation at The Grill at The Dorchester.\n\nDate: Thursday, 28 May 2026\nTime: 19:30\nGuests: 4\nReference: DC-4471",
    },
    {
      id: "t4",
      received: "2026-05-21T11:08:00Z",
      mailbox: "house@kanzen.family",
      sender: "service@hudsonsandler.co.uk",
      subject: "HVAC quarterly service confirmation · Apt 5206, 28 May 09:00",
      category: "Service / Appointment",
      confidence: 0.94,
      extracted: {
        vendor: "Hudson Sandler",
        property: "Wardian",
        date: "2026-05-28",
        time: "09:00–12:00",
        purpose: "Daikin VRV-IV quarterly service",
      },
      proposedActions: [
        { type: "create_event", target: "Google Calendar", title: "HVAC service — Hudson Sandler", time: "Thu 28 May · 09:00–12:00" },
        { type: "create_task", target: "Todoist · Wardian", title: "Be present for HVAC service (access)", assignee: "Marcia" },
        { type: "link_plan", target: "Maintenance · Daikin VRV-IV", title: "Mark plan as scheduled" },
      ],
      bodyExcerpt: "Hi Flavian,\n\nConfirming our quarterly service visit:\n\nDate: Thursday 28 May, 09:00–12:00\nProperty: Apt 5206, Wardian\nEngineer: Robert Kane\nWork: Daikin VRV-IV quarterly maintenance + filter change.",
    },
    {
      id: "t5",
      received: "2026-05-20T22:55:00Z",
      mailbox: "accounts@kanzen.family",
      sender: "renewals@gov.uk",
      subject: "Action required: TV licence renewal · expires 14 July 2026",
      category: "Official / Renewal",
      confidence: 0.88,
      extracted: {
        type: "TV Licence renewal",
        body: "TV Licensing UK",
        deadline: "2026-07-14",
      },
      proposedActions: [
        { type: "file_document", target: "Drive · Wardian / Official / 2026", title: "TV Licence renewal notice.pdf" },
        { type: "set_reminder", target: "Reminders", title: "TV Licence renewal — 7 days before 14 Jul" },
      ],
      bodyExcerpt: "Your TV Licence is due to expire on 14 July 2026. To avoid interruption, please renew before this date.",
    },
  ],
  agentHistory: [
    { id: "h1", at: "2026-05-22T06:30:00Z", category: "Delivery", action: "Auto-executed", title: "Amazon delivery — Wed 21 May, 14:00–16:00", outcome: "Task + event created" },
    { id: "h2", at: "2026-05-21T19:11:00Z", category: "Statement", action: "Auto-executed", title: "Coutts April statement filed", outcome: "Filed to Drive" },
    { id: "h3", at: "2026-05-21T14:02:00Z", category: "Booking", action: "Confirmed by Lorna", title: "Hairdresser · 23 May 10:30", outcome: "Event created" },
    { id: "h4", at: "2026-05-21T09:40:00Z", category: "Service", action: "Confirmed by Flavian", title: "Pool service Singapore — 25 May", outcome: "Event + task created · plan linked" },
    { id: "h5", at: "2026-05-20T17:22:00Z", category: "Other", action: "Rejected by Lorna", title: "Marketing email · The Conran Shop", outcome: "Dismissed, sender learning" },
  ],
  trustSettings: [
    { category: "Delivery", routing: "auto", note: "Promoted 12 May after 47 confirmations" },
    { category: "Statement", routing: "auto", note: "Promoted 02 May after 32 confirmations" },
    { category: "Booking", routing: "review", note: "" },
    { category: "Service / Appointment", routing: "review", note: "" },
    { category: "Bill / Invoice", routing: "review", note: "Financial — always review" },
    { category: "Official / Renewal", routing: "review", note: "" },
    { category: "Other / Unclear", routing: "review", note: "" },
  ],
  upcomingEvents: [
    { id: "ev1", title: "Waitrose delivery", date: "2026-05-26", time: "11:00–12:00", category: "Delivery", color: "#4F46E5", property: "Wardian", source: "agent" },
    { id: "ev2", title: "HVAC service — Hudson Sandler", date: "2026-05-28", time: "09:00–12:00", category: "Maintenance", color: "#0EA5E9", property: "Wardian", source: "maintenance" },
    { id: "ev3", title: "Dinner — The Dorchester", date: "2026-05-28", time: "19:30", category: "Booking", color: "#A855F7", property: "—", source: "agent" },
    { id: "ev4", title: "Lorna — annual review", date: "2026-06-02", time: "All day", category: "HR", color: "#F97316", property: "—", source: "manual" },
    { id: "ev5", title: "Pool service — Singapore", date: "2026-06-04", time: "10:00", category: "Maintenance", color: "#0EA5E9", property: "Singapore", source: "maintenance" },
    { id: "ev6", title: "Ballymore service charge", date: "2026-07-01", time: "Due", category: "Finance", color: "#15803D", property: "Wardian", source: "bill" },
  ],
  expiringSoon: [
    { id: "x1", item: "BCS Cleaning · NDA", until: "2026-06-30", days: 38, kind: "NDA" },
    { id: "x2", item: "Tan Hardware · Insurance", until: "2026-08-04", days: 73, kind: "Insurance" },
    { id: "x3", item: "Sonos Architectural · warranty", until: "2025-09-04", days: -260, kind: "Warranty", lapsed: true },
    { id: "x4", item: "Siti Rahmat · Work Permit", until: "2026-07-12", days: 50, kind: "Visa" },
  ],
  budgets: {
    wardian: { spent: 7842, budget: 12000, currency: "GBP", periods: [62, 71, 58, 80, 65] },
    singapore: { spent: 14210, budget: 24000, currency: "SGD", periods: [58, 60, 53, 92, 59] },
  },
  paymentMethods: [
    { id: "pm1", name: "Coutts Current", type: "Bank account", last4: "0418", currency: "GBP", owner: "Flavian", uses: ["Direct Debit"], usedFor: 6, status: "Active" },
    { id: "pm2", name: "Coutts Reserve", type: "Bank account", last4: "9871", currency: "GBP", owner: "Flavian", uses: ["Bank Transfer"], usedFor: 2, status: "Active" },
    { id: "pm3", name: "Amex Platinum", type: "Credit card", last4: "1003", currency: "GBP", owner: "Flavian", uses: ["Card payments"], usedFor: 4, expires: "2028-09", status: "Active" },
    { id: "pm4", name: "Amex Gold · Lorna", type: "Credit card", last4: "4422", currency: "GBP", owner: "Lorna", uses: ["Household card"], usedFor: 3, expires: "2027-04", status: "Active", note: "Limit £5,000/mo" },
    { id: "pm5", name: "HSBC Singapore", type: "Bank account", last4: "2245", currency: "SGD", owner: "Flavian", uses: ["GIRO"], usedFor: 3, status: "Active" },
    { id: "pm6", name: "DBS Multi-currency", type: "Bank account", last4: "8809", currency: "SGD", owner: "Flavian", uses: ["Bank Transfer"], usedFor: 1, status: "Active" },
    { id: "pm7", name: "Wise Business", type: "Multi-currency", last4: "0033", currency: "Multi", owner: "Kanzen Holdings", uses: ["Cross-border"], usedFor: 0, status: "Standby" },
  ],
  payQueue: [
    { id: "pq1", billId: "b3", payee: "Hyperoptic", amount: 45.00, currency: "GBP", due: "2026-06-01", method: "pm3", auto: true, status: "Scheduled", days: 10 },
    { id: "pq2", billId: "b1", payee: "Octopus Energy", amount: 218.40, currency: "GBP", due: "2026-06-04", method: "pm1", auto: true, status: "Scheduled", days: 13 },
    { id: "pq3", billId: "b7", payee: "Singtel Fibre", amount: 88.00, currency: "SGD", due: "2026-06-05", method: "pm3", auto: true, status: "Scheduled", days: 14 },
    { id: "pq4", billId: "b6", payee: "SP Group", amount: 612.80, currency: "SGD", due: "2026-06-08", method: "pm5", auto: false, status: "Awaiting review", days: 17, varianceFlag: true },
    { id: "pq5", billId: "b2", payee: "Thames Water", amount: 64.12, currency: "GBP", due: "2026-06-12", method: "pm1", auto: true, status: "Scheduled", days: 21 },
    { id: "pq6", billId: "b5", payee: "Bupa Health", amount: 412.55, currency: "GBP", due: "2026-06-15", method: "pm1", auto: true, status: "Scheduled", days: 24 },
    { id: "pq7", billId: "b8", payee: "Pool & Garden Co.", amount: 480.00, currency: "SGD", due: "2026-06-20", method: "pm6", auto: false, status: "Manual transfer", days: 29 },
    { id: "pq8", billId: "b4", payee: "Ballymore Service Charge", amount: 4280.00, currency: "GBP", due: "2026-07-01", method: "pm2", auto: false, status: "Awaiting review", days: 40 },
  ],
  // Grocery & supplies — household lists
  lists: [
    {
      id: "gw",
      name: "Grocery — Wardian",
      type: "grocery",
      property: "wardian",
      cycle: "Weekly · Tue delivery",
      vendor: "Waitrose",
      assignee: "Marcia",
      lastOrder: "2026-05-15",
      nextOrder: "2026-05-26",
      items: [
        { id: "i1", name: "Sourdough loaf", category: "Bakery", qty: 1, status: "added", recurring: true, addedBy: "Marcia" },
        { id: "i2", name: "Whole milk · 2L", category: "Dairy", qty: 2, status: "added", recurring: true, addedBy: "Marcia" },
        { id: "i3", name: "Free-range eggs · dozen", category: "Dairy", qty: 1, status: "added", recurring: true, addedBy: "Marcia" },
        { id: "i4", name: "Espresso beans · Square Mile", category: "Coffee", qty: 2, status: "added", recurring: true, addedBy: "Flavian" },
        { id: "i5", name: "Avocados · ripe", category: "Produce", qty: 6, status: "added", recurring: false, addedBy: "Marcia" },
        { id: "i6", name: "Sea bass fillets", category: "Fish", qty: 4, status: "needs_approval", recurring: false, addedBy: "Marcia", note: "For Thu dinner — Dorchester is dropping a course request" },
        { id: "i7", name: "Truffle (fresh)", category: "Produce", qty: 1, status: "needs_approval", recurring: false, addedBy: "Marcia", price: 95, currency: "GBP" },
        { id: "i8", name: "Sparkling water · case", category: "Drinks", qty: 1, status: "added", recurring: true, addedBy: "Marcia" },
      ],
    },
    {
      id: "gs",
      name: "Grocery — Singapore",
      type: "grocery",
      property: "singapore",
      cycle: "Weekly · Thu delivery",
      vendor: "Cold Storage",
      assignee: "Siti",
      lastOrder: "2026-05-15",
      nextOrder: "2026-05-29",
      items: [
        { id: "j1", name: "Jasmine rice · 5kg", category: "Pantry", qty: 1, status: "added", recurring: true, addedBy: "Siti" },
        { id: "j2", name: "Mangoes · honey", category: "Produce", qty: 6, status: "added", recurring: true, addedBy: "Siti" },
        { id: "j3", name: "Sambal oelek", category: "Pantry", qty: 1, status: "added", recurring: false, addedBy: "Siti" },
        { id: "j4", name: "Tiger prawns · 500g", category: "Fish", qty: 1, status: "added", recurring: false, addedBy: "Siti" },
      ],
    },
    {
      id: "sw",
      name: "Supplies — Wardian",
      type: "supplies",
      property: "wardian",
      cycle: "Monthly · 1st",
      vendor: "Ocado",
      assignee: "Marcia",
      lastOrder: "2026-05-01",
      nextOrder: "2026-06-01",
      items: [
        { id: "s1", name: "Bin liners · 50L · 30pk", category: "Cleaning", qty: 2, status: "added", recurring: true, addedBy: "Marcia" },
        { id: "s2", name: "Method dish soap", category: "Cleaning", qty: 3, status: "added", recurring: true, addedBy: "Marcia" },
        { id: "s3", name: "Egyptian cotton hand towels", category: "Linen", qty: 4, status: "needs_approval", recurring: false, addedBy: "Marcia", price: 220, currency: "GBP" },
        { id: "s4", name: "Dyson filter — V15", category: "Appliance", qty: 1, status: "added", recurring: false, addedBy: "Marcia" },
      ],
    },
  ],
  // Permissions matrix
  roles: [
    { id: "principal", name: "Principal", person: "Flavian", color: "#4F46E5" },
    { id: "manager", name: "Manager", person: "Lorna", color: "#F97316" },
    { id: "prop_manager", name: "Property manager", person: "— · future SG lead", color: "#0EA5E9", scope: "Singapore only" },
    { id: "staff_w", name: "Staff", person: "Marcia · Wardian", color: "#34C759", scope: "Wardian only" },
    { id: "staff_s", name: "Staff", person: "Siti · Singapore", color: "#34C759", scope: "Singapore only" },
  ],
  modules: [
    { id: "dashboard", name: "Dashboard", group: "Overview" },
    { id: "triage", name: "Triage (agent)", group: "Overview" },
    { id: "properties", name: "Properties · Bibles", group: "Operations" },
    { id: "tasks", name: "Tasks", group: "Operations" },
    { id: "calendar", name: "Calendar", group: "Operations" },
    { id: "maintenance", name: "Maintenance plans", group: "Operations" },
    { id: "lists", name: "Lists · grocery", group: "Operations" },
    { id: "people", name: "People · HR", group: "Records" },
    { id: "vendors", name: "Vendors", group: "Records" },
    { id: "vehicles", name: "Vehicles", group: "Records" },
    { id: "documents", name: "Documents · index", group: "Records" },
    { id: "documents_private", name: "Private documents", group: "Records", restricted: true },
    { id: "finance_bills", name: "Bills schedule", group: "Finance" },
    { id: "finance_pay", name: "Pay queue", group: "Finance" },
    { id: "finance_expenses", name: "Expenses", group: "Finance" },
    { id: "finance_approve", name: "Approvals", group: "Finance" },
    { id: "finance_budgets", name: "Budgets", group: "Finance" },
    { id: "payment_methods", name: "Payment methods", group: "Finance", restricted: true },
    { id: "directory", name: "Directory", group: "System" },
    { id: "settings", name: "Settings", group: "System" },
    { id: "audit", name: "Audit log", group: "System", restricted: true },
  ],
  // perms: principal / manager / prop_manager / staff_w / staff_s — one of: none, read, write, admin
  permissions: {
    dashboard:           ["admin", "write", "write", "read",  "read"],
    triage:              ["admin", "write", "read",  "none",  "none"],
    properties:          ["admin", "write", "write", "read",  "read"],
    tasks:               ["admin", "write", "write", "write", "write"],
    calendar:            ["admin", "write", "write", "read",  "read"],
    maintenance:         ["admin", "write", "write", "read",  "read"],
    lists:               ["admin", "write", "write", "write", "write"],
    people:              ["admin", "write", "read",  "none",  "none"],
    vendors:             ["admin", "write", "read",  "read",  "read"],
    vehicles:            ["admin", "write", "read",  "none",  "none"],
    documents:           ["admin", "write", "read",  "read",  "read"],
    documents_private:   ["admin", "none",  "none",  "none",  "none"],
    finance_bills:       ["admin", "write", "read",  "none",  "none"],
    finance_pay:         ["admin", "write", "read",  "none",  "none"],
    finance_expenses:    ["admin", "write", "write", "write", "write"],
    finance_approve:     ["admin", "read",  "read",  "none",  "none"],
    finance_budgets:     ["admin", "read",  "read",  "none",  "none"],
    payment_methods:     ["admin", "read",  "none",  "none",  "none"],
    directory:           ["admin", "write", "read",  "read",  "read"],
    settings:            ["admin", "read",  "read",  "none",  "none"],
    audit:               ["admin", "none",  "none",  "none",  "none"],
  },
  documents: [
    { id: "d1", name: "Wardian — Title deed.pdf", category: "Legal", property: "wardian", expiry: "—", access: "Private" },
    { id: "d2", name: "Daikin warranty certificate.pdf", category: "Warranty", property: "wardian", expiry: "2030-07-01", access: "Shared" },
    { id: "d3", name: "Cluny Park lease — executed.pdf", category: "Legal", property: "singapore", expiry: "2027-12-31", access: "Private" },
    { id: "d4", name: "Lorna · Contract of employment.pdf", category: "HR", property: "—", expiry: "—", access: "Private" },
  ],
};

window.DATA = DATA;

// helpers
window.fmtMoney = (amount, currency) => {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};
window.fmtDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
window.fmtDateShort = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
window.fmtDayLong = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};
window.daysUntil = (iso) => {
  const d = new Date(iso);
  const now = new Date("2026-05-22");
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
};
window.relativeTime = (iso) => {
  const d = new Date(iso);
  const now = new Date("2026-05-22T10:00:00Z");
  const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.round(diff / 60) + " min ago";
  if (diff < 86400) return Math.round(diff / 3600) + "h ago";
  const days = Math.round(diff / 86400);
  if (days < 7) return days + "d ago";
  return window.fmtDateShort(iso);
};
