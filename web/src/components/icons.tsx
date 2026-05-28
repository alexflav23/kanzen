// Inline-SVG icon set — ported 1:1 from the design export (`input/icons.jsx`): 24×24 viewBox,
// 1.6px stroke, round caps/joins, currentColor. Export names are stable (call sites unchanged).
import type { ReactNode } from "react";

type P = { size?: number };
const Base = ({ size = 16, children, fill = "none" }: P & { children: ReactNode; fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

export const Plus = ({ size }: P) => <Base size={size}><path d="M12 5v14" /><path d="M5 12h14" /></Base>;
export const ChevronRight = ({ size }: P) => <Base size={size}><path d="M9 6l6 6-6 6" /></Base>;
export const ChevronDown = ({ size }: P) => <Base size={size}><path d="M6 9l6 6 6-6" /></Base>;
export const ChevronLeft = ({ size }: P) => <Base size={size}><path d="M15 6l-6 6 6 6" /></Base>;
export const ArrowRight = ({ size }: P) => <Base size={size}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></Base>;
export const Check = ({ size }: P) => <Base size={size}><path d="M4 12l5 5L20 6" /></Base>;
export const X = ({ size }: P) => <Base size={size}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Base>;
export const Search = ({ size }: P) => <Base size={size}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></Base>;
export const Bell = ({ size }: P) => <Base size={size}><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 19a2 2 0 004 0" /></Base>;
export const Pin = ({ size }: P) => <Base size={size}><path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z" /><circle cx="12" cy="9" r="2.5" /></Base>;
export const Filter = ({ size }: P) => <Base size={size}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" /></Base>;
export const Shield = ({ size }: P) => <Base size={size}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></Base>;
export const Layers = ({ size }: P) => <Base size={size}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /><path d="M3 17l9 5 9-5" /></Base>;
export const Alert = ({ size }: P) => <Base size={size}><path d="M12 3l10 17H2L12 3z" /><path d="M12 10v4" /><circle cx="12" cy="17" r=".5" fill="currentColor" /></Base>;
export const Wrench = ({ size }: P) => <Base size={size}><path d="M14 6a4 4 0 014 5l4 4-3 3-4-4a4 4 0 01-5-4l-3-3a4 4 0 010-6l3 3a4 4 0 014 0z" transform="rotate(45 12 12)" /></Base>;
export const Box = ({ size }: P) => <Base size={size}><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></Base>;
// nav + chrome (grouped sidebar)
export const Grid = ({ size }: P) => <Base size={size}><rect x="3.5" y="3.5" width="7" height="9" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.5" /><rect x="13.5" y="10.5" width="7" height="10" rx="1.5" /></Base>;
export const Inbox = ({ size }: P) => <Base size={size}><path d="M3 13v6a2 2 0 002 2h14a2 2 0 002-2v-6" /><path d="M5 3h14l2 10h-5l-2 3h-4l-2-3H3l2-10z" /></Base>;
export const PieChart = ({ size }: P) => <Base size={size}><path d="M12 3v9l8 4.5A9 9 0 1112 3z" /><path d="M21 11A9 9 0 0012 3v8h9z" /></Base>;
export const Home = ({ size }: P) => <Base size={size}><path d="M3 11l9-7 9 7" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></Base>;
export const Tasks = ({ size }: P) => <Base size={size}><path d="M4 6l2 2 4-4" /><path d="M12 7h8" /><path d="M4 14l2 2 4-4" /><path d="M12 15h8" /></Base>;
export const Calendar = ({ size }: P) => <Base size={size}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /></Base>;
export const Receipt = ({ size }: P) => <Base size={size}><path d="M5 3v18l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5 2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z" /><path d="M8 9h8M8 13h8M8 17h5" /></Base>;
export const People = ({ size }: P) => <Base size={size}><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M15 20c0-2.4 1.8-4.5 4-4.5" /></Base>;
export const Vendors = ({ size }: P) => <Base size={size}><path d="M3 8l1.5-3h15L21 8" /><path d="M3 8h18v3a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0V8z" /><path d="M5 12v8h14v-8" /></Base>;
export const Vehicle = ({ size }: P) => <Base size={size}><path d="M3 13l2-5a2 2 0 012-1.5h10a2 2 0 012 1.5l2 5" /><path d="M3 13v4a1 1 0 001 1h2a1 1 0 001-1v-1h10v1a1 1 0 001 1h2a1 1 0 001-1v-4" /><circle cx="7" cy="14" r="1" /><circle cx="17" cy="14" r="1" /></Base>;
export const Documents = ({ size }: P) => <Base size={size}><path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M14 3v5h5" /></Base>;
export const Finance = ({ size }: P) => <Base size={size}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h3" /></Base>;
export const Database = ({ size }: P) => <Base size={size}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></Base>;
export const Settings = ({ size }: P) => <Base size={size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.5 1.5 0 00.3 1.6l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.5 1.5 0 00-1.6-.3 1.5 1.5 0 00-.9 1.4V21a2 2 0 11-4 0v-.1a1.5 1.5 0 00-1-1.4 1.5 1.5 0 00-1.6.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.5 1.5 0 00.3-1.6 1.5 1.5 0 00-1.4-.9H3a2 2 0 110-4h.1a1.5 1.5 0 001.4-1 1.5 1.5 0 00-.3-1.6l-.1-.1a2 2 0 112.8-2.8l.1.1a1.5 1.5 0 001.6.3H9a1.5 1.5 0 00.9-1.4V3a2 2 0 114 0v.1a1.5 1.5 0 00.9 1.4 1.5 1.5 0 001.6-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.5 1.5 0 00-.3 1.6V9a1.5 1.5 0 001.4.9H21a2 2 0 110 4h-.1a1.5 1.5 0 00-1.4.9z" /></Base>;
export const Trending = ({ size }: P) => <Base size={size}><path d="M3 17l6-6 4 4 8-9" /><path d="M14 6h7v7" /></Base>;
export const External = ({ size }: P) => <Base size={size}><path d="M14 5h5v5" /><path d="M19 5l-8 8" /><path d="M19 14v5h-14V5h5" /></Base>;
export const Image = ({ size }: P) => <Base size={size}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M21 17l-6-6-9 9" /></Base>;
export const Move = ({ size }: P) => <Base size={size}><path d="M12 4v16M4 12h16M9 7l3-3 3 3M9 17l3 3 3-3M7 9l-3 3 3 3M17 9l3 3-3 3" /></Base>;
export const Moon = ({ size }: P) => <Base size={size}><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" /></Base>;
export const Sun = ({ size }: P) => <Base size={size}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></Base>;
// no design equivalent — kept as clean stroke icons in the same 1.6px style
export const Trash = ({ size }: P) => <Base size={size}><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></Base>;
export const Star = ({ size }: P) => <Base size={size}><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z" /></Base>;
export const StarFill = ({ size }: P) => <Base size={size} fill="currentColor"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z" /></Base>;
