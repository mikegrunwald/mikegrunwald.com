import { loadMarkdown, loadCollection } from '$lib/server/markdown';

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

  return {
    project,
    nextProject,
    // The transition handoff matches on this. loadMarkdown() returns only
    // { html, meta }, so without it the detail page cannot say which project it
    // is, and the seed check silently refuses every time.
    slug
  };
}