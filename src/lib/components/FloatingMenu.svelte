<script>
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import siteSettings from '$content/meta/site.json';
	import { resolveMenuLink } from '$lib/nav/resolveMenuLink.js';
	import { trackClick } from '$lib/track';

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
	let panel;

	// One-shot: set immediately before the programmatic hidePopover() below, read
	// and cleared by the `toggle` handler it causes. The popover `toggle` event is
	// dispatched ASYNCHRONOUSLY (the spec queues it; only `beforetoggle` is
	// synchronous), so this cannot be cleared right after hidePopover() returns —
	// onToggle would not have run yet. Clearing it inside onToggle instead makes
	// the lifetime exactly "one toggle", and because the flag is only ever set on
	// a branch that definitely calls hidePopover(), that toggle is guaranteed to
	// arrive and the flag can never be left stranded to suppress a later Escape.
	let suppressFocusRecovery = false;

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
	//
	// The activeElement === body test alone is NOT sufficient to tell those paths
	// apart: clicking a menu link ALSO leaves activeElement on <body>, so the
	// navigation close would pass the test and yank focus back to the trigger,
	// fighting SvelteKit's own post-navigation focus reset. Hence the explicit
	// flag — Escape and outside-click still recover, navigation does not.
	//
	// The inPanel test covers a third path: closing via the panel's OWN close
	// button — the primary keyboard route, since the close button is the first
	// tabbable element in the panel.
	//
	// Chrome does NOT actually need it: its popover focus restoration moves focus
	// from the close button back to the invoker synchronously inside
	// hidePopover(), so by the time this (async) toggle handler runs activeElement
	// is already the trigger and inPanel is false — verified in Chrome 148 with an
	// isolated popover carrying no focus JS at all. The clause is defence in depth
	// for engines that do not restore invoker focus, where activeElement would
	// still be the close button here and the body test alone would skip recovery,
	// stranding the next Tab at the top of the document (WCAG 2.4.3).
	//
	// It is safe precisely because anything focused inside a panel that is closing
	// is about to be blurred, so recovering focus is never wrong there. Note the
	// fromNavigation short-circuit still runs first, so this cannot re-steal focus
	// after a menu-link navigation.
	function onToggle(event) {
		open = event.newState === 'open';

		const fromNavigation = suppressFocusRecovery;
		suppressFocusRecovery = false;

		const inPanel = panel?.contains(document.activeElement);

		if (!open && !fromNavigation && (document.activeElement === document.body || inPanel)) {
			trigger?.focus();
		}
	}

	// The component lives in the root layout, so it survives navigation and the
	// panel would otherwise stay open in the top layer, covering the destination:
	// popover="auto" light-dismiss does not fire for clicks INSIDE the popover.
	//
	// No href inspection is needed, and none should be added: resolveMenuLink
	// gives every external link and every document target="_blank", so those open
	// in a new tab and produce no same-page navigation — afterNavigate simply
	// never fires for them. The missing external-link branch is correct.
	afterNavigate(() => {
		// hidePopover() throws InvalidStateError when the popover is not showing,
		// and afterNavigate also runs on the initial page load with the panel
		// closed — so the open check is required, not defensive noise.
		if (panel?.matches(':popover-open')) {
			suppressFocusRecovery = true;
			panel.hidePopover();
		}
	});

	// External links and documents can never represent the current page.
	function isCurrent(item) {
		return item.isInternal && item.href === page.url.pathname;
	}

	// Home should always land at the top. The layout normally RESTORES the
	// homepage scroll position on return (so a carousel zoom-out lands where you
	// left off), but an explicit "Home" click should override that and go to the
	// top. The layout owns Lenis and that restoration state, so signal it rather
	// than scrolling from here. This also covers the same-URL case — already on
	// '/', where no navigation, and therefore no afterNavigate, fires.
	function onLinkClick(item) {
		// GA click-through for the floating menu. Fired on every item (internal,
		// external, and document links alike) — the label is the CMS-authored menu
		// label, matching what the user sees. Runs before the home-reset branch so
		// the same-URL "Home" click, which triggers no navigation, is still counted.
		trackClick('Floating Menu', item.label);

		if (item.isInternal && item.href === '/') {
			window.dispatchEvent(new CustomEvent('menu-home-reset'));
		}
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

		<nav
			bind:this={panel}
			class="panel"
			id={PANEL_ID}
			popover="auto"
			aria-label="Site"
			ontoggle={onToggle}
		>
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
				<!-- Keyed by index deliberately: the list is derived once at module
				     evaluation, never reorders and is never mutated, so index keys are
				     stable. A content key is not safe here — the items are CMS-authored,
				     so a duplicated label+url is a plausible typo, and a duplicate key
				     THROWS in Svelte's client-side each block, which would survive
				     prerender and blank the page on hydration. -->
				{#each items as item, i (i)}
					<li class="item" style="--i: {i}">
						<a
							class="link"
							href={item.href}
							target={item.target}
							rel={item.rel}
							download={item.download}
							aria-current={isCurrent(item) ? 'page' : undefined}
							onclick={() => onLinkClick(item)}
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

		--menu-button-size: 2.25rem;
		/* transparent, NOT the panel bg — an opaque trigger would paint over the
		   magnetic cursor dot (CursorDot sits at z-index 100 in normal flow).
		   The panel fades its own background in instead; see .panel below. */
		--menu-button-bg: transparent;
		--menu-button-radius: var(--border-radius);

		--menu-bar-width: 1rem;
		--menu-bar-thickness: 1px;
		--menu-bar-gap: 0.15rem;
		--menu-bar-color: var(--color-text-primary);

		--menu-panel-padding: calc(var(--spacing-xxs) * 1.5);
		--menu-panel-bg: rgba(0, 0, 0, 0.4);
		--menu-panel-color: var(--color-text-primary);
		--menu-panel-radius: var(--border-radius);
		--menu-panel-min-width: 10rem;
		/* Bounds an unbounded, CMS-editable item list to the viewport, leaving the
		   panel's own offset as breathing room at top and bottom. */
		--menu-panel-max-height: calc(100dvh - var(--menu-offset) * 2);

		--menu-item-gap: var(--spacing-xxs);
		--menu-item-shift: 22px;

		--menu-duration: var(--animation-duration-fast);
		--menu-ease: var(--ease-out-cubic);
		--menu-item-stagger: 110ms;

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

		/* Required, not merely nice-to-have: the clip-path below clips to the
		   border box, so items overflowing an unbounded panel would be neither
		   visible nor reachable. Capping the height and scrolling keeps every
		   item inside the clipped box. */
		max-height: var(--menu-panel-max-height);
		overflow-y: auto;

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
		font-size: 20px;
		text-transform: uppercase;
		letter-spacing: 0.015em;
	}

	.item {
		margin-bottom: 0;
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
