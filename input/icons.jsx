// Kanzen — icon set. Stroke style, 1.5px, 16x16 default
const Icon = ({ d, paths, size = 16, stroke = "currentColor", strokeWidth = 1.6, fill = "none", style, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    {...rest}
  >
    {d ? <path d={d} /> : paths}
  </svg>
);

const I = {
  Dashboard: (p) => <Icon {...p} paths={<><rect x="3.5" y="3.5" width="7" height="9" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5"/></>} />,
  Triage: (p) => <Icon {...p} paths={<><path d="M3 6h18"/><path d="M6 12h12"/><path d="M10 18h4"/></>} />,
  Property: (p) => <Icon {...p} paths={<><path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/></>} />,
  Tasks: (p) => <Icon {...p} paths={<><path d="M4 6l2 2 4-4"/><path d="M12 7h8"/><path d="M4 14l2 2 4-4"/><path d="M12 15h8"/></>} />,
  People: (p) => <Icon {...p} paths={<><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2.4 1.8-4.5 4-4.5"/></>} />,
  Vendors: (p) => <Icon {...p} paths={<><path d="M3 8l1.5-3h15L21 8"/><path d="M3 8h18v3a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0V8z"/><path d="M5 12v8h14v-8"/></>} />,
  Finance: (p) => <Icon {...p} paths={<><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/></>} />,
  Documents: (p) => <Icon {...p} paths={<><path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/></>} />,
  Vehicle: (p) => <Icon {...p} paths={<><path d="M3 13l2-5a2 2 0 012-1.5h10a2 2 0 012 1.5l2 5"/><path d="M3 13v4a1 1 0 001 1h2a1 1 0 001-1v-1h10v1a1 1 0 001 1h2a1 1 0 001-1v-4"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/></>} />,
  Calendar: (p) => <Icon {...p} paths={<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/></>} />,
  Directory: (p) => <Icon {...p} paths={<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16"/><circle cx="12" cy="14" r="2.5"/><path d="M8 19c.5-1.8 2-3 4-3s3.5 1.2 4 3"/></>} />,
  Settings: (p) => <Icon {...p} paths={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.5 1.5 0 00.3 1.6l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.5 1.5 0 00-1.6-.3 1.5 1.5 0 00-.9 1.4V21a2 2 0 11-4 0v-.1a1.5 1.5 0 00-1-1.4 1.5 1.5 0 00-1.6.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.5 1.5 0 00.3-1.6 1.5 1.5 0 00-1.4-.9H3a2 2 0 110-4h.1a1.5 1.5 0 001.4-1 1.5 1.5 0 00-.3-1.6l-.1-.1a2 2 0 112.8-2.8l.1.1a1.5 1.5 0 001.6.3H9a1.5 1.5 0 00.9-1.4V3a2 2 0 114 0v.1a1.5 1.5 0 00.9 1.4 1.5 1.5 0 001.6-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.5 1.5 0 00-.3 1.6V9a1.5 1.5 0 001.4.9H21a2 2 0 110 4h-.1a1.5 1.5 0 00-1.4.9z"/></>} />,
  Search: (p) => <Icon {...p} paths={<><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></>} />,
  Bell: (p) => <Icon {...p} paths={<><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 004 0"/></>} />,
  Plus: (p) => <Icon {...p} paths={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />,
  Check: (p) => <Icon {...p} paths={<><path d="M4 12l5 5L20 6"/></>} />,
  X: (p) => <Icon {...p} paths={<><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>} />,
  ChevronRight: (p) => <Icon {...p} paths={<path d="M9 6l6 6-6 6"/>} />,
  ChevronDown: (p) => <Icon {...p} paths={<path d="M6 9l6 6 6-6"/>} />,
  ChevronLeft: (p) => <Icon {...p} paths={<path d="M15 6l-6 6 6 6"/>} />,
  Arrow: (p) => <Icon {...p} paths={<><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></>} />,
  External: (p) => <Icon {...p} paths={<><path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M19 14v5h-14V5h5"/></>} />,
  Edit: (p) => <Icon {...p} paths={<><path d="M4 20h4l11-11-4-4L4 16v4z"/><path d="M14 5l4 4"/></>} />,
  Mail: (p) => <Icon {...p} paths={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>} />,
  Sparkle: (p) => <Icon {...p} paths={<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></>} />,
  Alert: (p) => <Icon {...p} paths={<><path d="M12 3l10 17H2L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></>} />,
  Sun: (p) => <Icon {...p} paths={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></>} />,
  Moon: (p) => <Icon {...p} paths={<path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/>} />,
  Clock: (p) => <Icon {...p} paths={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  Filter: (p) => <Icon {...p} paths={<path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/>} />,
  Box: (p) => <Icon {...p} paths={<><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></>} />,
  Wrench: (p) => <Icon {...p} paths={<path d="M14 6a4 4 0 014 5l4 4-3 3-4-4a4 4 0 01-5-4l-3-3a4 4 0 010-6l3 3a4 4 0 014 0z" transform="rotate(45 12 12)"/>} />,
  Drive: (p) => <Icon {...p} paths={<><path d="M8 4l8 0 5 8.5L16 21H8L3 12.5z"/><path d="M8 4l5 8.5M16 4l-5 8.5L16 21M3 12.5h18"/></>} />,
  Todoist: (p) => <Icon {...p} paths={<><circle cx="12" cy="12" r="9"/><path d="M7 11l3 3 7-7"/></>} />,
  Gmail: (p) => <Icon {...p} paths={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></>} />,
  Lock: (p) => <Icon {...p} paths={<><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></>} />,
  Receipt: (p) => <Icon {...p} paths={<><path d="M5 3v18l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5 2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z"/><path d="M8 9h8M8 13h8M8 17h5"/></>} />,
  Building: (p) => <Icon {...p} paths={<><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M10 21v-3h4v3"/></>} />,
  Sliders: (p) => <Icon {...p} paths={<><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></>} />,
  Phone: (p) => <Icon {...p} paths={<rect x="6" y="2" width="12" height="20" rx="3"/>} />,
  Globe: (p) => <Icon {...p} paths={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></>} />,
  Watch: (p) => <Icon {...p} paths={<><circle cx="12" cy="12" r="5"/><path d="M9 7l-1-3h8l-1 3M9 17l-1 3h8l-1-3M12 9v3l2 1.5"/></>} />,
  Guitar: (p) => <Icon {...p} paths={<><circle cx="9" cy="15" r="3.5"/><path d="M11.5 12.5l5-5 1.5-1.5 1.5 1.5-1.5 1.5-5 5"/><path d="M14 8l3 3"/></>} />,
  Glass: (p) => <Icon {...p} paths={<><path d="M7 4h10l-1 11a3 3 0 01-3 3h-2a3 3 0 01-3-3L7 4z"/><path d="M12 18v3M9 21h6"/></>} />,
  Shirt: (p) => <Icon {...p} paths={<path d="M9 3l3 2 3-2 4 3-2 3-2-1v11H8V8L6 9 4 6l5-3z"/>} />,
  Chair: (p) => <Icon {...p} paths={<><path d="M6 4h12v6H6z"/><path d="M5 10v7M19 10v7M6 14h12"/></>} />,
  Art: (p) => <Icon {...p} paths={<><rect x="4" y="3" width="16" height="16" rx="1.5"/><circle cx="9" cy="9" r="1.5"/><path d="M20 14l-5-5-9 9"/><path d="M3 21h18"/></>} />,
  Diamond: (p) => <Icon {...p} paths={<><path d="M6 3h12l3 5-9 13L3 8z"/><path d="M3 8h18M9 3l3 5 3-5M9 8l3 13M15 8l-3 13"/></>} />,
  Layers: (p) => <Icon {...p} paths={<><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></>} />,
  Tag: (p) => <Icon {...p} paths={<><path d="M3 12V4a1 1 0 011-1h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor"/></>} />,
  Heart: (p) => <Icon {...p} paths={<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>} />,
  PieChart: (p) => <Icon {...p} paths={<><path d="M12 3v9l8 4.5A9 9 0 1112 3z"/><path d="M21 11A9 9 0 0012 3v8h9z"/></>} />,
  Database: (p) => <Icon {...p} paths={<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>} />,
  Photo: (p) => <Icon {...p} paths={<><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M21 17l-6-6-9 9"/></>} />,
  Pin: (p) => <Icon {...p} paths={<><path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></>} />,
  Refresh: (p) => <Icon {...p} paths={<><path d="M20 4v6h-6"/><path d="M4 20v-6h6"/><path d="M20 10a8 8 0 00-14-3M4 14a8 8 0 0014 3"/></>} />,
  Inbox: (p) => <Icon {...p} paths={<><path d="M3 13v6a2 2 0 002 2h14a2 2 0 002-2v-6"/><path d="M5 3h14l2 10h-5l-2 3h-4l-2-3H3l2-10z"/></>} />,
  Download: (p) => <Icon {...p} paths={<><path d="M12 4v12M6 12l6 6 6-6M4 20h16"/></>} />,
  Shield: (p) => <Icon {...p} paths={<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5L16 9.5"/></>} />,
  Pound: (p) => <Icon {...p} paths={<path d="M16 7a3 3 0 00-6 0v4H7M7 14h10M10 7v8c0 1.5-1 3-3 4h12"/>} />,
  Sparkles: (p) => <Icon {...p} paths={<><path d="M5 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/><path d="M16 12l1.5 3 3 1-3 1-1.5 3-1.5-3-3-1 3-1 1.5-3z"/><path d="M12 3l.5 1.5L14 5l-1.5.5L12 7l-.5-1.5L10 5l1.5-.5L12 3z"/></>} />,
  Move: (p) => <Icon {...p} paths={<><path d="M12 4v16M4 12h16M9 7l3-3 3 3M9 17l3 3 3-3M7 9l-3 3 3 3M17 9l3 3-3 3"/></>} />,
  Trending: (p) => <Icon {...p} paths={<><path d="M3 17l6-6 4 4 8-9"/><path d="M14 6h7v7"/></>} />,
  Eye: (p) => <Icon {...p} paths={<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>} />,
};

window.I = I;
window.Icon = Icon;
