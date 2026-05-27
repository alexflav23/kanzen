// Minimal inline-SVG icon set (the prototype's icon font isn't bundled).
type P = { size?: number };
const s = (n = 16) => ({ width: n, height: n, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const Plus = ({ size }: P) => (<svg {...s(size)}><path d="M12 5v14M5 12h14" /></svg>);
export const ChevronRight = ({ size }: P) => (<svg {...s(size)}><path d="M9 6l6 6-6 6" /></svg>);
export const ArrowRight = ({ size }: P) => (<svg {...s(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const Box = ({ size }: P) => (<svg {...s(size)}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" /></svg>);
export const Search = ({ size }: P) => (<svg {...s(size)}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>);
export const Bell = ({ size }: P) => (<svg {...s(size)}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>);
export const Pin = ({ size }: P) => (<svg {...s(size)}><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>);
export const Filter = ({ size }: P) => (<svg {...s(size)}><path d="M3 5h18l-7 8v6l-4-2v-4z" /></svg>);
export const ChevronDown = ({ size }: P) => (<svg {...s(size)}><path d="M6 9l6 6 6-6" /></svg>);
export const X = ({ size }: P) => (<svg {...s(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const Shield = ({ size }: P) => (<svg {...s(size)}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>);
export const Layers = ({ size }: P) => (<svg {...s(size)}><path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" /></svg>);
export const Alert = ({ size }: P) => (<svg {...s(size)}><path d="M12 9v4m0 4h.01M10.3 4l-8 14h19.4l-8-14a2 2 0 00-3.4 0z" /></svg>);
export const Wrench = ({ size }: P) => (<svg {...s(size)}><path d="M14 7a4 4 0 01-5 5l-5 5 2 2 5-5a4 4 0 005-5l-2 2-2-2 2-2z" /></svg>);
export const Check = ({ size }: P) => (<svg {...s(size)}><path d="M20 6L9 17l-5-5" /></svg>);
// nav + chrome icons (match the design's grouped sidebar)
export const Grid = ({ size }: P) => (<svg {...s(size)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
export const Inbox = ({ size }: P) => (<svg {...s(size)}><path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5" /></svg>);
export const PieChart = ({ size }: P) => (<svg {...s(size)}><path d="M12 3v9l8 4" /><circle cx="12" cy="12" r="9" /></svg>);
export const Home = ({ size }: P) => (<svg {...s(size)}><path d="M3 11l9-7 9 7M5 10v10h14V10" /></svg>);
export const Tasks = ({ size }: P) => (<svg {...s(size)}><path d="M4 6h2l1 1 2-2M11 6h9M4 12h2l1 1 2-2M11 12h9M4 18h2l1 1 2-2M11 18h9" /></svg>);
export const Calendar = ({ size }: P) => (<svg {...s(size)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>);
export const Receipt = ({ size }: P) => (<svg {...s(size)}><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1zM8 8h8M8 12h8" /></svg>);
export const People = ({ size }: P) => (<svg {...s(size)}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0M16 5a3 3 0 010 6M21 20a6 6 0 00-4-5.7" /></svg>);
export const Vendors = ({ size }: P) => (<svg {...s(size)}><path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6" /></svg>);
export const Vehicle = ({ size }: P) => (<svg {...s(size)}><path d="M3 12l2-5h14l2 5v5h-2a2 2 0 01-4 0H9a2 2 0 01-4 0H3zM3 12h18" /></svg>);
export const Documents = ({ size }: P) => (<svg {...s(size)}><path d="M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6" /></svg>);
export const Finance = ({ size }: P) => (<svg {...s(size)}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v6M18 9v6" /></svg>);
export const Database = ({ size }: P) => (<svg {...s(size)}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>);
export const Settings = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></svg>);
export const Trending = ({ size }: P) => (<svg {...s(size)}><path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5" /></svg>);
export const External = ({ size }: P) => (<svg {...s(size)}><path d="M14 5h5v5M19 5l-8 8M12 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-6" /></svg>);
export const Moon = ({ size }: P) => (<svg {...s(size)}><path d="M21 12.8A8 8 0 1111.2 3a6 6 0 009.8 9.8z" /></svg>);
export const Sun = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>);
