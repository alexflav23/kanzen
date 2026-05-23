// Minimal inline-SVG icon set (the prototype's icon font isn't bundled).
type P = { size?: number };
const s = (n = 16) => ({ width: n, height: n, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const Plus = ({ size }: P) => (<svg {...s(size)}><path d="M12 5v14M5 12h14" /></svg>);
export const ChevronRight = ({ size }: P) => (<svg {...s(size)}><path d="M9 6l6 6-6 6" /></svg>);
export const ArrowRight = ({ size }: P) => (<svg {...s(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const Box = ({ size }: P) => (<svg {...s(size)}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" /></svg>);
export const Search = ({ size }: P) => (<svg {...s(size)}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>);
export const Bell = ({ size }: P) => (<svg {...s(size)}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>);
