import { loadCollection } from '$lib/server/markdown';

export async function load() {
  const work = loadCollection('src/content/work');

  return { work };
}