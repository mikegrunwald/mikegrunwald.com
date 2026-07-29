// Single source of truth for the cursor sound mapping. Mutated live by the
// ?debug panel; read by CursorDot on each hover. Committed values here are what
// production plays — tune them via the panel, then paste back (Task 6).
export const NONE = 'none';

export const EVENTS = ['enter', 'leave', 'click'];

// Tuned via the ?debug "Sounds" panel. Each event value must be an id in
// SOUND_NAMES (see core/core-patch.json) or the NONE sentinel. Re-tune anytime
// in the panel and paste "Copy sound config" back over these values.
export const soundConfig = {
	enter: 'scroll-snap',
	leave: 'blur',
	click: 'sync',
	volume: 0.5,
	muted: false
};
