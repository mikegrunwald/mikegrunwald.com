import { loadCollection } from '$lib/server/markdown';

export async function load() {
  const projects = loadCollection('src/content/projects')
    .sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));

  return { projects };
}