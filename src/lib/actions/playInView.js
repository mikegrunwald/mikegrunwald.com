// Teaser videos autoplay only while on screen — a grid of simultaneously
// decoding videos is the cost this avoids. Under reduced motion the video stays
// paused on its first frame (poster).
export function playInView(node) {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		node.removeAttribute('autoplay');
		return { destroy() {} };
	}
	const io = new IntersectionObserver(
		([entry]) => {
			if (entry.isIntersecting) node.play?.().catch(() => {});
			else node.pause?.();
		},
		{ threshold: 0.1 }
	);
	io.observe(node);
	return { destroy: () => io.disconnect() };
}
