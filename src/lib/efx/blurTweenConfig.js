// Pure tween configuration for the blur text effect.
//
// Extracted from BlurScrollEffect so the option matrix — scrub vs enter,
// stagger direction, paused, reduced motion — can be tested. The effect class
// itself cannot be: this project's vitest environment is `node`, so there is no
// DOM to split text in and no GSAP to drive it.

export const BLUR_START = 'blur(6px)';
export const BLUR_END = 'blur(0px)';

const STAGGER_EACH = 0.05;
const ENTER_DURATION = 0.9;

export function buildBlurTween({
	mode = 'scrub',
	from = 'start',
	delay = 0,
	paused = false,
	reduceMotion = false,
	trigger
} = {}) {
	// Reduced motion is not "a faster animation" — it is the end state, applied
	// at once. Returning an empty fromVars matters as much as the end state
	// itself: setting opacity 0 first and relying on a 0-duration tween to undo
	// it would flash hidden content if that tween were ever not run.
	if (reduceMotion) {
		return {
			fromVars: {},
			toVars: {
				opacity: 1,
				filter: BLUR_END,
				duration: 0,
				delay: 0,
				paused: false
			}
		};
	}

	const fromVars = {
		opacity: 0,
		filter: BLUR_START,
		willChange: 'opacity, filter'
	};

	const toVars = {
		opacity: 1,
		filter: BLUR_END,
		stagger: { each: STAGGER_EACH, from },
		delay,
		paused,
		// Scrub maps the playhead to scroll position, so an ease would fight the
		// scroll; on a self-playing entrance it is what makes it feel deliberate.
		ease: mode === 'enter' ? 'power2.out' : 'none'
	};

	// Enter mode always gets a duration for the self-playing animation.
	if (mode === 'enter') {
		toVars.duration = ENTER_DURATION;
	}

	// A paused tween is started by hand — that is the whole point of pausing it.
	// Giving it a ScrollTrigger too would mean two things racing to play it.
	if (paused) return { fromVars, toVars };

	// Non-paused tweens get their scroll trigger.
	if (mode === 'enter') {
		toVars.scrollTrigger = { trigger, start: 'top bottom-=10%', once: true };
	} else {
		toVars.scrollTrigger = {
			trigger,
			start: 'top bottom-=10%',
			end: 'bottom center+=15%',
			scrub: true
		};
	}

	return { fromVars, toVars };
}
