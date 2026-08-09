// Shared-spotlight glow (inspiration: CodePen jh3y/WNmQXyE). One pointer
// listener on the grid writes each card's pointer-relative position to --mx/--my;
// each card's ::before paints a primary-tinted radial glow masked to its border,
// so the border lights up only near the cursor — a single light source across
// the whole grid, not per-card :hover. Tint is always --color-primary.
export function cardLocal(rect, clientX, clientY) {
	return { mx: clientX - rect.left, my: clientY - rect.top };
}

export function spotlight(node) {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	function onMove(e) {
		for (const card of node.querySelectorAll('[data-spotlight-card]')) {
			const { mx, my } = cardLocal(card.getBoundingClientRect(), e.clientX, e.clientY);
			card.style.setProperty('--mx', `${mx}px`);
			card.style.setProperty('--my', `${my}px`);
		}
	}

	function enable() {
		if (!reduce.matches) node.addEventListener('pointermove', onMove);
	}
	function disable() {
		node.removeEventListener('pointermove', onMove);
	}

	enable();
	reduce.addEventListener('change', () => {
		disable();
		enable();
	});

	return { destroy: disable };
}
