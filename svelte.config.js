import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "@sveltejs/adapter-cloudflare";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "200.html", // allows client-side routing on Cloudflare Pages
      strict: true
    }),

    prerender: {
      entries: ["*"], // ensures the entire site is pre-rendered
      handleHttpError: "ignore" // prevents failure on 404 pages
    },

    alias: {
      $assets: "src/assets",
      $lib: "src/lib"
    }
  },

  preprocess: [vitePreprocess()]
};

export default config;