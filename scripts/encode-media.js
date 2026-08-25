// Generate every derived media file the site needs from src/content/work.
//
// One pass per work entry, two outputs:
//   • carousel teaser — first VIDEO in `media` → static/video/teasers/<slug>.mp4,
//     540p / ≤16s, plus a `teaser:` frontmatter field (site-relative path;
//     getAssetUrl resolves it to R2 in prod). Not committed (*.mp4 is ignored):
//     the homepage ring plays the teaser, detail pages play full-res media[0].
//   • archive thumb — first IMAGE in `media` → static/images/projects/archive/
//     <slug>.webp, 768px wide. The /work archive's hover reveal preloads the
//     whole set, so it must be small; the full-res stills are megabytes each.
//     Committed, because /work is prerendered and the loader checks the file
//     exists at build time (see src/routes/work/+page.server.ts).
//
// Both are skip-if-exists, so re-running only encodes what's missing. Needs
// local ffmpeg — Cloudflare's builder has none, which is why the outputs are
// either committed or pushed to R2 by `npm run upload-assets`.
//
// Usage: npm run media [-- --force] [-- --only=teasers|thumbs]
//   --force          re-encode even when the output already exists
//   --only=<kind>    just teasers, or just thumbs
//   --selftest       run the pure-logic self-check and exit

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const WORK_DIR = path.join(ROOT, 'src/content/work');
const TEASER_DIR = path.join(ROOT, 'static/video/teasers');
const THUMB_DIR = path.join(ROOT, 'static/images/projects/archive');
const TEASER_HEIGHT = 540;
const TEASER_MAX_SECONDS = 16;
// The reveal plane is capped at 640 CSS px wide (ArchiveRevealScene maxWidthPx),
// so 768 covers it with headroom without bloating the decoded-bitmap cache the
// scene holds in memory (~1.4MB per image).
const THUMB_WIDTH = 768;

const srcString = (entry) =>
	typeof entry === 'string' ? entry : (entry?.path ?? entry?.url ?? entry?.src ?? '');

const isVideo = (entry) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(srcString(entry));
const isImage = (entry) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(srcString(entry));

// Insert or replace the `teaser:` line without re-dumping the whole frontmatter
// (gray-matter's stringify reorders/normalizes YAML, which would churn every
// file). Returns the raw string unchanged if nothing needed to change.
function upsertTeaser(raw, teaserPath) {
	const line = `teaser: ${teaserPath}`;
	if (/^teaser:.*$/m.test(raw)) return raw.replace(/^teaser:.*$/m, line);
	if (/^media:/m.test(raw)) return raw.replace(/^media:/m, `${line}\nmedia:`);
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

function ffmpeg(args) {
	execFileSync('ffmpeg', ['-y', ...args], { stdio: 'inherit' });
}

const encodeTeaser = (src, out) =>
	ffmpeg([
		'-i',
		resolveSource(src),
		'-t',
		String(TEASER_MAX_SECONDS),
		'-vf',
		`scale=-2:${TEASER_HEIGHT}`,
		'-an', // teaser is only used by the muted ring
		'-c:v',
		'libx264',
		'-crf',
		'28',
		'-preset',
		'veryfast',
		'-movflags',
		'+faststart',
		out
	]);

const encodeThumb = (src, out) =>
	ffmpeg([
		'-i',
		resolveSource(src),
		'-frames:v',
		'1', // animated gif/webp sources: first frame only
		'-vf',
		`scale='min(${THUMB_WIDTH},iw)':-1`, // never upscale
		'-c:v',
		'libwebp',
		'-quality',
		'72',
		out
	]);

// The two outputs, described declaratively so the main loop stays one pass.
const KINDS = {
	teasers: {
		dir: TEASER_DIR,
		ext: 'mp4',
		pick: (media) => media.find(isVideo),
		encode: encodeTeaser
	},
	thumbs: {
		dir: THUMB_DIR,
		ext: 'webp',
		pick: (media) => media.find(isImage),
		encode: encodeThumb
	}
};

function selftest() {
	const assert = (c, m) => {
		if (!c) throw new Error(m);
	};
	assert(isVideo('/video/a.mp4') && !isVideo('/uploads/a.png'), 'isVideo');
	assert(isVideo('https://x/a.MP4?v=1'), 'isVideo query');
	assert(isImage('/uploads/a.png') && isImage('/uploads/a.JPG?v=2'), 'isImage');
	assert(!isImage('/video/a.mp4') && !isImage(''), 'isImage rejects video');
	assert(isImage({ src: 'https://x/y.gif' }), 'isImage object entry');
	assert(resolveSource('https://x/y.png') === 'https://x/y.png', 'remote passthrough');
	assert(resolveSource('/uploads/y.png').endsWith('/static/uploads/y.png'), 'local resolve');
	const withField = '---\nteaser: /old.mp4\nmedia:\n  - x\n---\n';
	assert(upsertTeaser(withField, '/new.mp4').includes('teaser: /new.mp4'), 'replace');
	const noField = '---\nyear: 2022\nmedia:\n  - x\n---\n';
	assert(upsertTeaser(noField, '/t.mp4').includes('teaser: /t.mp4\nmedia:'), 'insert before media');
	assert(
		upsertTeaser('---\nyear: 2022\n---\n', '/t.mp4') === '---\nyear: 2022\n---\n',
		'no media noop'
	);
	const media = ['/video/a.mp4', '/uploads/b.png'];
	assert(KINDS.teasers.pick(media) === '/video/a.mp4', 'teaser picks video');
	assert(KINDS.thumbs.pick(media) === '/uploads/b.png', 'thumb picks image');
	console.log('selftest ok');
}

function main() {
	const args = process.argv.slice(2);
	if (args.includes('--selftest')) return selftest();
	const force = args.includes('--force');
	const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
	if (only && !KINDS[only]) {
		console.error(`unknown --only=${only}; expected one of: ${Object.keys(KINDS).join(', ')}`);
		process.exit(1);
	}
	const kinds = Object.entries(KINDS).filter(([name]) => !only || name === only);

	for (const [, kind] of kinds) fs.mkdirSync(kind.dir, { recursive: true });
	const files = fs.readdirSync(WORK_DIR).filter((f) => f.endsWith('.md'));
	let ffmpegChecked = false;
	let ffmpegOk = false;
	const stats = Object.fromEntries(
		kinds.map(([name]) => [name, { encoded: 0, skipped: 0, noSource: 0, missing: 0 }])
	);
	let mdUpdated = 0;

	for (const file of files) {
		const slug = file.replace(/\.md$/, '');
		const full = path.join(WORK_DIR, file);
		const raw = fs.readFileSync(full, 'utf8');
		const { data } = matter(raw);
		const media = data.media ?? [];

		for (const [name, kind] of kinds) {
			const stat = stats[name];
			const source = kind.pick(media);
			if (!source) {
				stat.noSource++;
				continue;
			}

			const outFile = path.join(kind.dir, `${slug}.${kind.ext}`);
			if (fs.existsSync(outFile) && !force) {
				stat.skipped++;
			} else {
				if (!ffmpegChecked) {
					ffmpegOk = hasFfmpeg();
					ffmpegChecked = true;
				}
				if (!ffmpegOk) {
					console.warn(`⚠ ffmpeg not found — no ${name} for ${slug}.`);
					stat.missing++;
					continue;
				}
				console.log(`${name}: ${slug} ← ${srcString(source)}`);
				kind.encode(srcString(source), outFile);
				stat.encoded++;
			}

			// Teasers are referenced from frontmatter (they're not committed, so a
			// build machine can't probe for them); thumbs are found on disk.
			if (name === 'teasers') {
				const next = upsertTeaser(raw, `/video/teasers/${slug}.mp4`);
				if (next !== raw) {
					fs.writeFileSync(full, next);
					mdUpdated++;
				}
			}
		}
	}

	for (const [name, s] of Object.entries(stats)) {
		console.log(
			`${name}: ${s.encoded} encoded, ${s.skipped} up-to-date` +
				`${s.noSource ? `, ${s.noSource} no-source` : ''}` +
				`${s.missing ? `, ${s.missing} MISSING (no ffmpeg)` : ''}`
		);
	}
	if (mdUpdated) console.log(`${mdUpdated} markdown files updated`);
}

main();
