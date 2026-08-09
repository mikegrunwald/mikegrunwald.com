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
			<tr>
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
					data-archive-row
					data-index={i}
					onpointerenter={(e) => rowEnter(e, row)}
					onpointermove={(e) => rowMove(e, row)}
					onpointerleave={rowLeave}
					onfocusin={(e) => rowFocus(e, row)}
					onfocusout={rowLeave}
				>
					<td class="archive__title">
						{#if row.link}
							<a
								class="archive__link"
								href={row.link}
								target={isExternal(row.link) ? '_blank' : null}
								rel={isExternal(row.link) ? 'noopener noreferrer' : null}
								data-cursor="magnetic">{row.title}</a
							>
						{:else}
							{row.title}
						{/if}
					</td>
					<td>{row.agency}</td>
					<td>{row.role}</td>
					<td>{row.year}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style lang="scss">
	.project-archive__title {
		margin: var(--spacing-base) 0 var(--spacing-sm);
	}
	.archive-reveal {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		pointer-events: none;
		z-index: 200; /* above table (page-wrapper z:1), below CursorDot (300) + menu */
	}
	.archive {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-body-sm);
	}
	.archive th {
		text-align: left;
		font-weight: var(--font-weight-normal);
		color: var(--color-text-secondary);
		padding: var(--spacing-xs) var(--spacing-xs);
	}
	.archive__row {
		position: relative; /* stretched-link containing block + highlight bar */
		border-top: var(--border);
		/* Highlight bar: primary-tinted, revealed on hover/focus-within. */
		--row-highlight: 0;
		background: rgba(
			var(--color-primary-rgb),
			calc(var(--row-highlight) * var(--archive-highlight-alpha, 0.12))
		);
		transition: background var(--animation-duration-fast, 0.25s) var(--ease-out, ease);
	}
	.archive__row td {
		padding: var(--spacing-xs) var(--spacing-xs);
	}
	/* Only linked rows get the pointer + stretched hit area. Unlinked rows keep
	   the default cursor but still light up + trigger the reveal. */
	.archive__row.is-link:hover,
	.archive__row.is-link:focus-within,
	.archive__row:hover,
	.archive__row:focus-within {
		--row-highlight: 1;
	}
	.archive__row:not(.is-link) {
		cursor: default;
	}
	.archive__link {
		text-decoration: none;
		color: inherit;
	}
	/* Stretched link: the whole row is clickable via the single title link. */
	.archive__row.is-link .archive__link::after {
		content: '';
		position: absolute;
		inset: 0;
	}
</style>
