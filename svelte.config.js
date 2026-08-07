import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
  preprocess: vitePreprocess(),
};

export default config;
