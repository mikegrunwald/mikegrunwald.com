<script>
	import { page } from '$app/state';
	import siteSettings from '$content/meta/site.json';
	import { resolveMenuLink } from '$lib/nav/resolveMenuLink.js';

	// Shared by popovertarget on both buttons and the panel's own id.
	const PANEL_ID = 'site-menu';

	// Items are derived once at module evaluation — the JSON is a build-time
	// import on a prerendered site, so it can never change at runtime.
	// Items missing either half of the pair are dropped rather than rendered as
	// a broken link; resolveMenuLink's contract assumes a usable URL.
	const items = (siteSettings.menu ?? [])
		.filter((item) => item?.label && item?.url)
		.map(resolveMenuLink);

	let open = $state(false);

	// The ONLY custom behaviour. popover="auto" already provides light-dismiss,
	// Escape, focus return, and Tab-into-panel ordering; this listener exists
	// purely to mirror the panel's state onto aria-expanded and the icon.
	function onToggle(event) {
		open = event.newState === 'open';
	}

	// External links and documents can never represent the current page.
	function isCurrent(item) {
		return item.isInternal && item.href === page.url.pathname;
	}
</script>

{#if items.length > 0}
	<div class="floating-menu">
		<button
			class="trigger"
			type="button"
			popovertarget={PANEL_ID}
			aria-label="Menu"
			aria-expanded={open}
			data-cursor="magnetic"
		>
			<span class="bars" aria-hidden="true"></span>
		</button>

		<nav class="panel" id={PANEL_ID} popover="auto" aria-label="Site" ontoggle={onToggle}>
			<button
				class="close"
				type="button"
				popovertarget={PANEL_ID}
				popovertargetaction="hide"
				aria-label="Close menu"
			>
				<span class="bars bars--x" aria-hidden="true"></span>
			</button>

			<ul class="list">
				{#each items as item, i (item.href + item.label)}
					<li class="item" style="--i: {i}">
						<a
							class="link"
							href={item.href}
							target={item.target}
							rel={item.rel}
							download={item.download}
							aria-current={isCurrent(item) ? 'page' : undefined}
						>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
{/if}
