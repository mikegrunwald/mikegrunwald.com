// One-shot scroll-in reveal: adds `is-revealed` when the node first crosses into
// view (IntersectionObserver, same pattern as playInView). CSS does the scale-up +
// fade; `index` staggers a group via --reveal-delay (index * step ms). Pass no
// index (default 0) for elements that enter view one at a time — a delay there
// reads as lag, not stagger.
//
// The revealed state animates transform to `none` (not scale(1)): a lingering
// transform makes the element a stacking context, which on the case-study cards
// would re-trap the magnetic cursor dot. `none` leaves no stacking context.
export function revealInView(node, { index = 0, step = 90 } = {}) {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		return { destroy() {} };
	}

	node.style.setProperty('--reveal-delay', `${index * step}ms`);

	const io = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return;
			node.classList.add('is-revealed');
			io.disconnect();
		},
		{ threshold: 0.2 }
	);
	io.observe(node);

	return { destroy: () => io.disconnect() };
}
