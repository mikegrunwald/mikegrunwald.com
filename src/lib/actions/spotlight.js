// Shared-spotlight glow (inspiration: CodePen jh3y/WNmQXyE). A single WINDOW
// pointer listener writes each card's pointer-relative position to --mx/--my;
// each card's border paints a primary-tinted radial glow masked to its edge, so
// it lights up on the side facing the cursor — a single light source across the
// whole grid, tracking the cursor even when it's outside the grid (a grid-scoped
// listener froze the glow the moment the pointer left it). Writes are coalesced
// to one rAF per frame so the per-card getBoundingClientRect never thrashes
// layout on high-frequency pointermove.
export function cardLocal(rect, clientX, clientY) {
	return { mx: clientX - rect.left, my: clientY - rect.top };
}

export function spotlight(node) {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
	// Start off-screen so nothing lights up before the first pointer move (matches
	// the CSS default of --mx/--my). The stored position is reused on scroll.
	let x = -10000;
	let y = -10000;
	let raf = 0;

	function apply() {
		raf = 0;
		for (const card of node.querySelectorAll('[data-spotlight-card]')) {
			const { mx, my } = cardLocal(card.getBoundingClientRect(), x, y);
			card.style.setProperty('--mx', `${mx}px`);
			card.style.setProperty('--my', `${my}px`);
		}
	}
	function schedule() {
		if (!raf) raf = requestAnimationFrame(apply);
	}
	function onMove(e) {
		x = e.clientX;
		y = e.clientY;
		schedule();
	}

	function enable() {
		if (reduce.matches) return;
		window.addEventListener('pointermove', onMove, { passive: true });
		// The cursor can be stationary while the page scrolls (card rects move but
		// no pointermove fires) — recompute against the last cursor position too.
		window.addEventListener('scroll', schedule, { passive: true, capture: true });
	}
	function disable() {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('scroll', schedule, { capture: true });
		if (raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
	}

	enable();
	reduce.addEventListener('change', () => {
		disable();
		enable();
	});

	return { destroy: disable };
}
