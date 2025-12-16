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
    nextProject
  };
}