import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // This app hydrates per-page state from localStorage (scores, trophies,
      // settings) after mount to avoid SSR/client markup mismatches — that is
      // a deliberate "sync from an external store on mount" effect, not the
      // render-time derivation this rule is meant to catch.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The libretro core is a prebuilt Emscripten artefact, not our source.
    "public/cores/**",
  ]),
]);

export default eslintConfig;
