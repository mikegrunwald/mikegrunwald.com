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
	let trigger;

	// Mirrors the panel's state onto aria-expanded and the icon, and recovers
	// focus on dismissal.
	//
	// popover="auto" provides light-dismiss, Escape, and Tab-into-panel ordering
	// for free, but NOT focus return here: opening hides the trigger
	// (visibility: hidden), which forces the browser to blur it, so focus falls
	// to <body> while the panel is open. There is then no invoker focus left for
	// the UA to restore, and Escape / outside-click both leave focus stranded on
	// <body> — verified in Chrome 148 on both paths.
	//
	// Recover ONLY if focus actually escaped to the body: refocusing
	// unconditionally would steal focus from a menu link the user just activated.
	function onToggle(event) {
		open = event.newState === 'open';
		if (!open && document.activeElement === document.body) {
			trigger?.focus();
		}
	}

	// External links and documents can never represent the current page.
	function isCurrent(item) {
		return item.isInternal && item.href === page.url.pathname;
	}
</script>

{#if items.length > 0}
	<div class="floating-menu">
		<button
			bind:this={trigger}
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

<style lang="scss">
	.floating-menu {
		/* Every value here is intended to be hand-tuned. */
		--menu-offset: var(--spacing-xs);

		--menu-button-size: 2.5rem;
		/* transparent, NOT the panel bg — an opaque trigger would paint over the
		   magnetic cursor dot (CursorDot sits at z-index 100 in normal flow).
		   The panel fades its own background in instead; see .panel below. */
		--menu-button-bg: transparent;
		--menu-button-radius: var(--border-radius);

		--menu-bar-width: 1.25rem;
		--menu-bar-thickness: 2px;
		--menu-bar-gap: 0.375rem;
		--menu-bar-color: var(--color-text-primary);

		--menu-panel-padding: var(--spacing-xs);
		--menu-panel-bg: var(--color-neutral-10);
		--menu-panel-color: var(--color-text-primary);
		--menu-panel-radius: var(--border-radius);
		--menu-panel-min-width: 10rem;

		--menu-item-gap: var(--spacing-xxs);
		--menu-item-shift: 8px;

		--menu-duration: var(--animation-duration-fast);
		--menu-ease: var(--ease-out-cubic);
		--menu-item-stagger: 40ms;

		/* The closed clip: a button-sized square pinned to the top-left corner
		   of the (full-size) panel. */
		--menu-clip-closed: inset(
			0 calc(100% - var(--menu-button-size)) calc(100% - var(--menu-button-size)) 0 round
				var(--menu-button-radius)
		);
	}

	/* --- Trigger ------------------------------------------------------------
	   Overrides src/scss/_buttons.scss, which gives every <button> an action
	   background, a border, the heading font and padding. */
	.trigger {
		position: fixed;
		top: var(--menu-offset);
		left: var(--menu-offset);
		z-index: 200;

		appearance: none;
		background: var(--menu-button-bg);
		border: 0;
		border-radius: var(--menu-button-radius);
		padding: 0;

		width: var(--menu-button-size);
		height: var(--menu-button-size);
		display: grid;
		place-items: center;
		/* _buttons.scss sets `transition: all 0.5s` on every <button>; left as
		   inherited, that would delay the `visibility: hidden` below by 500ms. */
		transition: none;
	}

	/* Hidden — not merely transparent — while the panel is open, so it leaves
	   the focus order too. The close button has already taken its exact place. */
	.floating-menu:has(.panel:popover-open) .trigger {
		visibility: hidden;
	}

	/* --- Panel --------------------------------------------------------------
	   Overrides the [popover] UA defaults: inset:0 + margin:auto (centring),
	   border:solid, padding, background:canvas, color:canvastext. */
	.panel {
		position: fixed;
		inset: auto;
		top: var(--menu-offset);
		left: var(--menu-offset);
		margin: 0;
		border: 0;

		/* Top padding clears the close button, which overlays the top-left. */
		padding: var(--menu-panel-padding);
		padding-top: calc(var(--menu-button-size) + var(--menu-item-gap));

		background: var(--menu-panel-bg);
		color: var(--menu-panel-color);
		border-radius: var(--menu-panel-radius);
		min-width: var(--menu-panel-min-width);
		width: max-content;

		/* No z-index: an open popover is in the top layer, above the fixed
		   canvas and the cursor dot without one. */

		clip-path: inset(0 0 0 0 round var(--menu-panel-radius));

		transition:
			clip-path var(--menu-duration) var(--menu-ease),
			background-color var(--menu-duration) var(--menu-ease),
			display var(--menu-duration) allow-discrete,
			/* `overlay` MUST be here with allow-discrete. Without it the element
			   leaves the top layer the instant it closes and the exit animation
			   is cut off — the panel would vanish instead of collapsing. */
				overlay var(--menu-duration) allow-discrete;
	}

	/* Closed / exiting state. */
	.panel:not(:popover-open) {
		clip-path: var(--menu-clip-closed);
		background-color: transparent;
	}

	/* Entry state. */
	@starting-style {
		.panel:popover-open {
			clip-path: var(--menu-clip-closed);
			background-color: transparent;
		}
	}

	/* --- Close button -------------------------------------------------------
	   Sits on the trigger's exact former footprint, which is what makes the
	   swap between the two buttons invisible. */
	.close {
		position: absolute;
		top: 0;
		left: 0;

		appearance: none;
		background: transparent;
		border: 0;
		border-radius: var(--menu-button-radius);
		padding: 0;

		width: var(--menu-button-size);
		height: var(--menu-button-size);
		display: grid;
		place-items: center;
		/* Same global `transition: all 0.5s` from _buttons.scss; pointless here
		   since only the .bars pseudo-elements should animate, not this button. */
		transition: none;
	}

	/* --- Bars ---------------------------------------------------------------
	   The element itself is a zero-ink anchor; the two visible bars are its
	   pseudo-elements, so a single span expresses both hamburger and X. */
	.bars {
		position: relative;
		display: block;
		width: var(--menu-bar-width);
		height: var(--menu-bar-thickness);
	}

	.bars::before,
	.bars::after {
		content: '';
		position: absolute;
		left: 0;
		width: var(--menu-bar-width);
		height: var(--menu-bar-thickness);
		background: var(--menu-bar-color);
		transition: transform var(--menu-duration) var(--menu-ease);
	}

	/* Hamburger pose — shared starting point for BOTH buttons' bars. */
	.bars::before {
		transform: translateY(calc(var(--menu-bar-gap) * -1));
	}
	.bars::after {
		transform: translateY(var(--menu-bar-gap));
	}

	/* The close button's bars rotate from that shared hamburger pose into an X.
	   Because the close button sits on the trigger's footprint and the trigger
	   hides on the same frame, the two bar sets are pixel-identical at the
	   handoff — so it reads as one hamburger folding, not a swap. */
	.panel:popover-open .bars--x::before {
		transform: translateY(0) rotate(45deg);
	}
	.panel:popover-open .bars--x::after {
		transform: translateY(0) rotate(-45deg);
	}

	@starting-style {
		.panel:popover-open .bars--x::before {
			transform: translateY(calc(var(--menu-bar-gap) * -1)) rotate(0deg);
		}
		.panel:popover-open .bars--x::after {
			transform: translateY(var(--menu-bar-gap)) rotate(0deg);
		}
	}

	/* --- List ---------------------------------------------------------------- */
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--menu-item-gap);
	}

	.item {
		opacity: 1;
		transform: translateX(0);
		transition:
			opacity var(--menu-duration) var(--menu-ease),
			transform var(--menu-duration) var(--menu-ease);
		/* --i is set inline per <li> from the array index, so the stagger works
		   for any number of CMS items — nth-child rules could not. */
		transition-delay: calc(var(--i) * var(--menu-item-stagger));
	}

	/* Closed / exiting: no stagger on the way out, so the panel does not wait
	   on the last item before collapsing. */
	.panel:not(:popover-open) .item {
		opacity: 0;
		transform: translateX(calc(var(--menu-item-shift) * -1));
		transition-delay: 0ms;
	}

	@starting-style {
		.panel:popover-open .item {
			opacity: 0;
			transform: translateX(calc(var(--menu-item-shift) * -1));
		}
	}

	.link {
		display: block;
		color: inherit;
		text-decoration: none;
		white-space: nowrap;

		&:hover {
			color: var(--color-action);
		}

		&[aria-current='page'] {
			color: var(--color-action);
		}
	}

	.trigger:focus-visible,
	.close:focus-visible,
	.link:focus-visible {
		outline: var(--focus-outline);
		outline-offset: var(--focus-outline-offset);
	}

	/* The menu still opens and closes — it just does so instantly. */
	@media (prefers-reduced-motion: reduce) {
		.floating-menu {
			--menu-duration: 0.01s;
			--menu-item-stagger: 0ms;
		}
	}
</style>
