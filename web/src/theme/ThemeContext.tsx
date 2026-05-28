import * as stylex from "@stylexjs/stylex";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { colors, radius, fonts } from "../styles/tokens.stylex";
import { darkTheme } from "../styles/themes/dark.stylex";

type Mode = "light" | "dark";
type Ctx = { theme: Mode; toggle: () => void; setTheme: (m: Mode) => void };

const ThemeContext = createContext<Ctx | null>(null);
const KEY = "kanzen-theme";

function persist(m: Mode) {
  try {
    window.localStorage.setItem(KEY, m);
  } catch {
    /* ignore (private mode / SSR) */
  }
}

function initialMode(): Mode {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage?.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

const styles = stylex.create({
  root: { minHeight: "100vh", backgroundColor: colors.bg, color: colors.ink, fontFamily: fonts.sans, fontFeatureSettings: '"ss01", "cv11"', WebkitFontSmoothing: "antialiased" },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    marginTop: "16px",
    padding: "8px 10px",
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSunken,
    color: colors.ink2,
    cursor: "pointer",
    fontSize: "13px",
    textAlign: "left",
  },
  kbd: {
    marginLeft: "auto",
    fontSize: "11px",
    color: colors.ink3,
    backgroundColor: colors.bgElev,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.line,
    borderRadius: "4px",
    padding: "1px 5px",
  },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Mode>(initialMode);

  const setTheme = useCallback((m: Mode) => {
    setThemeState(m);
    persist(m);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((t) => {
      const next: Mode = t === "dark" ? "light" : "dark";
      persist(next);
      return next;
    });
  }, []);

  // ⌘D / Ctrl-D toggles the theme (matches the design prototype).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={theme} {...stylex.props(styles.root, theme === "dark" && darkTheme)}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** Left-nav theme switch (⌘D also works). */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} data-testid="theme-toggle" aria-label="Toggle light/dark theme" {...stylex.props(styles.toggle)}>
      {theme === "dark" ? "☀︎ Light" : "☾ Dark"}
      <span {...stylex.props(styles.kbd)}>⌘D</span>
    </button>
  );
}
