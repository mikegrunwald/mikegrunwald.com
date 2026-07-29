// Sound registry — the ONLY module that knows about @web-kits/audio.
// Everything else imports SOUNDS / SOUND_NAMES from here, so swapping the
// underlying library (or falling back to a hand-rolled synth) touches one file.
//
// Sound definitions are the "Core" patch by Raphael Salaja (@web-kits/audio),
// MIT-licensed — see ./LICENSE-web-kits-audio.txt and ./core-patch.json. The
// patch is embedded as JSON (not installed via the interactive CLI, which
// cannot run in a non-TTY shell) and bound to play functions at load time.
//
// defineSound(def) returns a play function `(opts?: { volume?: number }) => VoiceHandle`.
// Binding is inert — no AudioContext is touched until a play function is called —
// so importing this module is safe in a non-browser (test) environment.
import { defineSound } from '@web-kits/audio';
import patch from './core-patch.json';

// { [name]: (opts?) => void } — e.g. SOUNDS['modal-open']({ volume: 0.5 })
export const SOUNDS = Object.fromEntries(
	Object.entries(patch.sounds).map(([name, def]) => [name, defineSound(def)])
);

// Sorted sound ids, e.g. ['archive', 'badge', … 'modal-open', 'modal-close', …]
export const SOUND_NAMES = Object.keys(SOUNDS).sort();
