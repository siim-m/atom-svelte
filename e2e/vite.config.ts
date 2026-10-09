import { fileURLToPath } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    fs: {
      // The app imports the library source from ../src.
      allow: [fileURLToPath(new URL("..", import.meta.url))],
    },
  },
});
