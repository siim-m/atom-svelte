import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ["browser"],
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    exclude: ["test/**/*.ssr.test.ts", "test/async-disabled/**/*.test.ts"],
  },
});
