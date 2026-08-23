/* PostCSS is loaded by the bundler, not by our own code, so there is no
   package type to lean on here — the shape is just "plugin name -> options". */
const config: { plugins: Record<string, Record<string, unknown>> } = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
