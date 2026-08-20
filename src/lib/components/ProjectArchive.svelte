<!-- src/lib/components/ProjectArchive.svelte -->
<script>
	let { archive = [] } = $props();

	// External links open in a new tab; internal paths navigate in place.
	const isExternal = (url) => /^https?:\/\//i.test(url ?? '');

	// The decorative WebGPU reveal is owned by the layout scene, which listens for
	// these window events (keeps this component free of any GPU dependency). Rows
	// with no still image emit nothing, so they light up (CSS) without a reveal.
	const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

	function rowEnter(e, row) {
		if (!row.image) return;
		emit('archive-reveal-enter', { image: row.image });
		emit('archive-reveal-move', { x: e.clientX, y: e.clientY });
	}
	function rowMove(e, row) {
		if (!row.image) return;
		emit('archive-reveal-move', { x: e.clientX, y: e.clientY });
	}
	function rowLeave() {
		emit('archive-reveal-leave');
	}
	// Keyboard: no pointer, so anchor the reveal at the focused row's center.
	function rowFocus(e, row) {
		if (!row.image) return;
		const r = e.currentTarget.getBoundingClientRect();
		emit('archive-reveal-enter', { image: row.image });
		emit('archive-reveal-move', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
	}
</script>

<section class="project-archive" aria-label="Project Archive">
	<h2 class="project-archive__title h1">Project Archive</h2>
	<!-- Decorative reveal surface: fixed, full-viewport, non-interactive; above
	     the table, below CursorDot. The layout scene binds a renderer to it. -->
	<canvas class="archive-reveal" data-gpu-archive aria-hidden="true"></canvas>
	<table class="archive">
		<thead>
			<tr class="h4">
				<th scope="col">Title</th>
				<th scope="col">Agency</th>
				<th scope="col">Role</th>
				<th scope="col">Year</th>
			</tr>
		</thead>
		<tbody>
			{#each archive as row, i (row.slug)}
				<tr
					class="archive__row"
					class:is-link={!!row.link}
					class:has-case-study={row.hasCaseStudy}
					data-archive-row
					data-index={i}
					onpointerenter={(e) => rowEnter(e, row)}
					onpointermove={(e) => rowMove(e, row)}
					onpointerleave={rowLeave}
					onfocusin={(e) => rowFocus(e, row)}
					onfocusout={rowLeave}
				>
					<td class="archive__title h5">
						{#if row.link}
							<a
								class="archive__link"
								href={row.link}
								target={isExternal(row.link) ? '_blank' : null}
								rel={isExternal(row.link) ? 'noopener noreferrer' : null}>{row.title}</a
							>
						{:else}
							{row.title}
						{/if}
					</td>
					<td class="meta-value">{row.agency}</td>
					<td class="meta-value">{row.role}</td>
					<td class="meta-value">{row.year}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style lang="scss">
	.project-archive__title {
		margin: var(--spacing-lg) 0 var(--spacing-base);
		/* Section is full-bleed; keep the heading aligned to the page inset. */
		padding-left: var(--spacing-base);
	}

	.archive__title {
		line-height: 1;
		margin-bottom: 0;
		vertical-align: middle;
	}

	.archive-reveal {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		pointer-events: none;
		/* Above the table, below the cursor dot (100) and menu (200). Was 200 and
		   relied on page-wrapper's z:1 to sit under the cursor; page-wrapper no
		   longer creates a stacking context (so the magnetic cursor can interleave
		   the case-study cards), so this is a real root-context z now. */
		z-index: 50;
	}
	/* Full-bleed: break out of .page-wrapper's --spacing-base padding so the table
	   (rows, borders, hover fill) spans the full screen width, tobacco.nl-style. */
	.project-archive {
		margin-inline: calc(var(--spacing-base) * -1);
	}
	.archive {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-body-xs);
	}
	.archive th {
		text-align: left;
		color: var(--color-primary);
		padding: 0 var(--spacing-xs) var(--spacing-xs);
	}
	/* Edge cells carry the page inset so text lines up with the rest of the site
	   while the row borders/backgrounds still run edge to edge. */
	.archive th:first-child,
	.archive__row td:first-child {
		padding-left: var(--spacing-base);
	}
	.archive th:last-child,
	.archive__row td:last-child {
		padding-right: var(--spacing-base);
		text-align: right;
	}
	.archive__row {
		position: relative; /* stretched-link containing block + highlight bar */
		border-top: var(--border-width) var(--border-style) var(--color-neutral-8);
		/* Highlight bar: primary-tinted, revealed on hover/focus-within. */
		--row-highlight: 0;
		background: rgba(
			var(--color-primary-rgb),
			calc(var(--row-highlight) * var(--archive-highlight-alpha, 0.12))
		);
		transition: background var(--animation-duration-fast, 0.25s) var(--ease-out, ease);
	}
	.archive__row td {
		padding: 24px;
	}

	.meta-value {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-body-xxs);
		letter-spacing: 0.01em;
		line-height: var(--line-height-text);
	}
	/* Only linked rows get the pointer + stretched hit area. Unlinked rows keep
	   the default cursor but still light up + trigger the reveal. */
	.archive__row.is-link:hover,
	.archive__row.is-link:focus-within,
	.archive__row:hover,
	.archive__row:focus-within {
		--row-highlight: 1;
		border-color: var(--color-primary);
		+ tr {
			border-color: var(--color-primary);
		}
	}
	.archive__row:not(.is-link) {
		cursor: default;
	}
	.archive__link {
		text-decoration: none;
		color: inherit;
	}
	/* Narrow viewports: drop the Agency column, least useful of the four. It
	   comes back below 768px, where the cells stack and width is free again. */
	@media (min-width: 768px) and (max-width: 1379px) {
		.archive th:nth-child(2),
		.archive__row td:nth-child(2) {
			display: none;
		}
	}
	/* Mobile: no room for columns — stack each row's cells, drop the now-
	   meaningless header row, and let the row carry the padding. */
	@media (max-width: 767px) {
		.archive,
		.archive tbody,
		.archive__row,
		.archive__row td {
			display: block;
		}
		.archive thead {
			display: none;
		}
		.archive__row {
			padding: var(--spacing-sm) var(--spacing-base);
		}
		.archive__row td,
		.archive__row td:first-child,
		.archive__row td:last-child {
			padding: 0;
			text-align: left;
		}
		.archive__title {
			margin-bottom: var(--spacing-xs);
		}
	}
	/* Stretched link: the whole row is clickable via the single title link. */
	.archive__row.is-link .archive__link::after {
		content: '';
		position: absolute;
		inset: 0;
	}
</style>
