import { loadCollection } from '$lib/server/markdown';

export async function load() {
  const work = loadCollection('src/content/work')
    .sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0));

  return { work };
}