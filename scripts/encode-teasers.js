// Generate carousel teaser videos from each work entry's first media video.
//
// The homepage ring plays a small, short teaser; the detail-page hero plays the
// full-res media[0]. This encodes media[0] down to 540p / ≤16s into
// static/video/teasers/<slug>.mp4 and writes the `teaser:` frontmatter field
// (a site-relative /video/teasers/... path; getAssetUrl resolves it to R2 in
// prod, local in dev). The teaser files are NOT committed — they're served from
// the local static dir in dev and from R2 in prod (push with `npm run
// upload-assets`). Runs only locally; Cloudflare has no ffmpeg. Skip-if-exists,
// so it only encodes what's missing (or everything with --force).
//
// Usage: node scripts/encode-teasers.js [--force]
//   --force      re-encode even if the teaser already exists
//   --selftest   run the pure-logic self-check and exit

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const WORK_DIR = path.join(ROOT, 'src/content/work');
const OUT_DIR = path.join(ROOT, 'static/video/teasers');
const TEASER_HEIGHT = 540;
const MAX_SECONDS = 16;

const isVideo = (entry) => {
	const s = typeof entry === 'string' ? entry : (entry?.path ?? entry?.url ?? entry?.src ?? '');
	return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(s);
};

const srcString = (entry) =>
	typeof entry === 'string' ? entry : (entry?.path ?? entry?.url ?? entry?.src ?? '');

// Insert or replace the `teaser:` line without re-dumping the whole frontmatter
// (gray-matter's stringify reorders/normalizes YAML, which would churn every
// file). Returns the raw string unchanged if nothing needed to change.
function upsertTeaser(raw, teaserPath) {
	const line = `teaser: ${teaserPath}`;
	if (new RegExp(`^teaser:.*$`, 'm').test(raw)) {
		return raw.replace(/^teaser:.*$/m, line);
	}
	if (/^media:/m.test(raw)) {
		return raw.replace(/^media:/m, `${line}\nmedia:`);
	}
	return raw; // no media block — nothing to anchor to
}

function hasFfmpeg() {
	try {
		execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function resolveSource(src) {
	if (/^https?:\/\//.test(src)) return src; // ffmpeg reads http(s) directly
	return path.join(ROOT, 'static', src.replace(/^\//, ''));
}

function encode(src, out) {
	execFileSync(
		'ffmpeg',
		[
			'-y',
			'-i', resolveSource(src),
			'-t', String(MAX_SECONDS),
			'-vf', `scale=-2:${TEASER_HEIGHT}`,
			'-an', // teaser is only used by the muted ring
			'-c:v', 'libx264',
			'-crf', '28',
			'-preset', 'veryfast',
			'-movflags', '+faststart',
			out
		],
		{ stdio: 'inherit' }
	);
}

function selftest() {
	const assert = (c, m) => {
		if (!c) throw new Error(m);
	};
	assert(isVideo('/video/a.mp4') && !isVideo('/uploads/a.png'), 'isVideo');
	assert(isVideo('https://x/a.MP4?v=1'), 'isVideo query');
	const withField = '---\nteaser: /old.mp4\nmedia:\n  - x\n---\n';
	assert(upsertTeaser(withField, '/new.mp4').includes('teaser: /new.mp4'), 'replace');
	const noField = '---\nyear: 2022\nmedia:\n  - x\n---\n';
	const inserted = upsertTeaser(noField, '/t.mp4');
	assert(inserted.includes('teaser: /t.mp4\nmedia:'), 'insert before media');
	assert(upsertTeaser('---\nyear: 2022\n---\n', '/t.mp4') === '---\nyear: 2022\n---\n', 'no media noop');
	console.log('selftest ok');
}

function main() {
	const args = process.argv.slice(2);
	if (args.includes('--selftest')) return selftest();
	const force = args.includes('--force');

	fs.mkdirSync(OUT_DIR, { recursive: true });
	const files = fs.readdirSync(WORK_DIR).filter((f) => f.endsWith('.md'));
	let ffmpegChecked = false;
	let ffmpegOk = false;
	const stats = { encoded: 0, skipped: 0, updated: 0, noVideo: 0, missing: 0 };

	for (const file of files) {
		const slug = file.replace(/\.md$/, '');
		const full = path.join(WORK_DIR, file);
		const raw = fs.readFileSync(full, 'utf8');
		const { data } = matter(raw);

		const source = (data.media ?? []).find(isVideo);
		if (!source) {
			stats.noVideo++;
			continue;
		}

		const outFile = path.join(OUT_DIR, `${slug}.mp4`);
		const teaserPath = `/video/teasers/${slug}.mp4`;

		if (!fs.existsSync(outFile) || force) {
			if (!ffmpegChecked) {
				ffmpegOk = hasFfmpeg();
				ffmpegChecked = true;
			}
			if (!ffmpegOk) {
				console.warn(`⚠ ffmpeg not found — cannot encode ${slug}; leaving teaser missing.`);
				stats.missing++;
			} else {
				console.log(`encoding ${slug} ← ${srcString(source)}`);
				encode(srcString(source), outFile);
				stats.encoded++;
			}
		} else {
			stats.skipped++;
		}

		const next = upsertTeaser(raw, teaserPath);
		if (next !== raw) {
			fs.writeFileSync(full, next);
			stats.updated++;
		}
	}

	console.log(
		`teasers: ${stats.encoded} encoded, ${stats.skipped} up-to-date, ${stats.updated} md updated` +
			`${stats.noVideo ? `, ${stats.noVideo} no-video` : ''}` +
			`${stats.missing ? `, ${stats.missing} MISSING (no ffmpeg)` : ''}`
	);
}

main();
