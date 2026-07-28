// Single source of truth for the cursor sound mapping. Mutated live by the
// ?debug panel; read by CursorDot on each hover. Committed values here are what
// production plays — tune them via the panel, then paste back (Task 6).
export const NONE = 'none';

export const EVENTS = ['enter', 'leave', 'click'];

// Starting points only — audition and finalize in the panel (Task 6).
// NOTE: these strings MUST be IDs that exist in SOUND_NAMES (Task 1 Step 2);
// if the patch names them camelCase, use that spelling instead.
export const soundConfig = {
	enter: 'modal-open',
	leave: 'modal-close',
	click: 'click',
	volume: 0.5,
	muted: false
};
