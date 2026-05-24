// StyleX static CSS extraction. The plugin scans the source for stylex.create /
// defineVars / createTheme and emits real atomic CSS into the `@stylex;`
// directive (src/stylex.css) — for both `vite dev` and `vite build`. This is
// what replaces runtime style injection.
//
// The plugin runs its OWN Babel pass (separate from Vite's React transform), so
// it needs to be told how to parse TS/TSX and given the StyleX plugin directly.
// Keeping this config isolated (babelrc/configFile false) avoids double-applying
// the transform that Vite's React plugin already does.
module.exports = {
  plugins: {
    "@stylexjs/postcss-plugin": {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      useCSSLayers: true,
      babelConfig: {
        babelrc: false,
        configFile: false,
        presets: ["@babel/preset-typescript"],
        plugins: [
          [
            "@stylexjs/babel-plugin",
            {
              dev: process.env.NODE_ENV !== "production",
              runtimeInjection: false,
              treeshakeCompensation: true,
              unstable_moduleResolution: { type: "commonJS", rootDir: __dirname },
            },
          ],
        ],
      },
    },
    autoprefixer: {},
  },
};
