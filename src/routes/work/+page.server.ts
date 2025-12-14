import { loadCollection } from '$lib/server/markdown';

export async function load() {
  const work = loadCollection('src/content/work')
    .sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));

  return { work };
}