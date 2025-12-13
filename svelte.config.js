import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "@sveltejs/adapter-cloudflare";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),

    alias: {
      $assets: "src/assets",
      $lib: "src/lib"
    },

    prerender: {
      handleHttpError: ({ path, message }) => {
        // Ignore 404s for static assets like videos and images during prerender
        if (path.startsWith('/video/') || path.startsWith('/uploads/')) {
          return;
        }
        // Throw error for other 404s
        throw new Error(message);
      }
    }
  },

  preprocess: [vitePreprocess()]
};

export default config;