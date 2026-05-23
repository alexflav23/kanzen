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
