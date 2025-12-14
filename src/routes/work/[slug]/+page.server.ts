import { loadMarkdown } from '$lib/server/markdown';

export async function load({ params }) {
  const { slug } = params;
  const project = loadMarkdown(`src/content/work/${slug}.md`);
  return { project };
}