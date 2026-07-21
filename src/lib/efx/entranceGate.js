// Runs a callback exactly once, no matter how many signals race to trigger it.
//
// The work detail header has two arrival paths that can each legitimately fire:
// the carousel transition overlay being dismissed, and fonts resolving on a
// direct load. On a transition arrival BOTH happen. Without this the entrance
// would restart mid-play.

export function createEntranceGate(onOpen) {
	let opened = false;

	return {
		open() {
			if (opened) return;
			// Set BEFORE invoking: if onOpen throws, the gate must still be closed
			// to re-entry. A half-built animation is better than two of them.
			opened = true;
			onOpen();
		},
		isOpen() {
			return opened;
		}
	};
}
