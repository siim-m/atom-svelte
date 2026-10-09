/** @type {import("@sveltejs/kit").Config} */
const config = {
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
  kit: {
    alias: {
      // Test the library source, not the built package.
      "@siim-m/atom-svelte": "../src/index.ts",
    },
    typescript: {
      config: (tsconfig) => {
        tsconfig.include.push("../playwright.config.ts", "../svelte.config.js");
      },
    },
  },
};

export default config;
