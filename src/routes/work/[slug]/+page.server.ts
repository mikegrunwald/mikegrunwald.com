import { loadMarkdown, loadCollection } from '$lib/server/markdown';
import { firstImage } from '$lib/seo.js';

export async function load({ params }) {
  const { slug } = params;
  const project = loadMarkdown(`src/content/work/${slug}.md`);

  // Load all projects in the same order as the work index page
  const allProjects = loadCollection('src/content/work')
    .sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0));

  // Find the current project index
  const currentIndex = allProjects.findIndex(p => p.slug === slug);

  // Get the next project (wrap around to first if at the end)
  const nextIndex = currentIndex === allProjects.length - 1 ? 0 : currentIndex + 1;
  const nextProject = allProjects[nextIndex];

  const meta = project.meta as Record<string, any>;

  return {
    project,
    nextProject,
    // The transition handoff matches on this. loadMarkdown() returns only
    // { html, meta }, so without it the detail page cannot say which project it
    // is, and the seed check silently refuses every time.
    slug,
    // Page metadata, derived here rather than in +page.svelte so the markdown
    // stripping (which the description needs) stays out of the client bundle.
    // Each field prefers an explicit CMS override, then falls back to content
    // that already exists — so every project gets a real title/description
    // without the author having to fill in SEO fields per entry.
    seo: {
      title: meta.seoTitle || meta.title || slug,
      // `subtitle` is the one-line pitch, so it leads; the long markdown
      // description backfills when a project has no subtitle. Truncation and
      // markdown stripping happen in buildSeo.
      description: meta.seoDescription || meta.subtitle || meta.description || '',
      // Videos come first in most `media` lists and scrapers cannot render
      // them, so pick the first still image. Projects with no still (the two
      // Spotify entries today) fall back to the site's default og image.
      image: meta.seoImage || firstImage(meta.media),
      type: 'article'
    }
  };
}