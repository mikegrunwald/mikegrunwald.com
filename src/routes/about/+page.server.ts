import { loadMarkdown } from '$lib/server/markdown';

export async function load() {
  const about = loadMarkdown('src/content/pages/about.md');
  const meta = about.meta as Record<string, any>;

  return {
    ...about,
    // Derived here rather than in +page.svelte so the markdown/html stripping
    // (buildSeo → plainText) runs at build time instead of shipping the page
    // body through the client just to produce a description. Falls back to the
    // rendered body when no `seoDescription` is authored in the CMS.
    seo: {
      title: meta.title || 'About',
      description: meta.seoDescription || about.html || ''
    }
  };
}
