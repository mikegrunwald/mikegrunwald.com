import { loadMarkdown } from '$lib/server/markdown';

export async function load() {
  return loadMarkdown('src/content/pages/about.md');
}