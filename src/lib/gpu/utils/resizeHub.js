// Fan-out for gpu-curtains' single-slot renderer.onAfterResize.
// The engine registers the ONE real callback; scenes/passes subscribe here.
export function createResizeHub() {
	const subscribers = new Set();
	return {
		add(cb) {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		},
		dispatch(...args) {
			for (const cb of subscribers) {
				try {
					cb(...args);
				} catch (e) {
					console.error('[resizeHub] subscriber error', e);
				}
			}
		},
		clear() {
			subscribers.clear();
		}
	};
}
