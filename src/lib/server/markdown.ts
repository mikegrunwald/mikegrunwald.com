import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

export function loadMarkdown(filePath: string) {
  const fullPath = path.join(process.cwd(), filePath);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  const { content, data } = matter(raw);

  const html = marked.parse(content);

  return {
    html,
    meta: data
  };
}

export function loadCollection(folder: string) {
  const dir = path.join(process.cwd(), folder);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  return files.map((filename) => {
    const { html, meta } = loadMarkdown(`${folder}/${filename}`);
    return {
      slug: filename.replace('.md', ''),
      html,
      meta
    };
  });
}