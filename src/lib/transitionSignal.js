// Whether a carousel transition overlay is currently up.
//
// The detail page's heading entrance must not start until the overlay lifts,
// and it needs to know at MOUNT time which arrival path it is on. It cannot
// listen for the start event itself: that event fires in the layout before the
// detail page mounts. So the listener lives here, at module scope, registered
// once when this module is first imported.
//
// Previously this was inferred from the presence of a transition handoff
// record, which was unsound — setHandoff() refuses records with a non-finite
// currentTime or a missing srcUrl, while the overlay goes up regardless, so a
// missing record did not imply a missing transition.

let active = false;

if (typeof window !== 'undefined') {
	window.addEventListener('project-transition-started', () => {
		active = true;
	});
	window.addEventListener('project-transition-dismissed', () => {
		active = false;
	});
}

export function isTransitionActive() {
	return active;
}
