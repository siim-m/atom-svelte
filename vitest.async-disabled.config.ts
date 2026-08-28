import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    svelte({
      configFile: false,
      compilerOptions: {
        experimental: {
          async: false,
        },
      },
      preprocess: vitePreprocess(),
    }),
  ],
  resolve: {
    conditions: ["browser"],
  },
  test: {
    environment: "jsdom",
    include: ["test/async-disabled/**/*.test.ts"],
  },
});
