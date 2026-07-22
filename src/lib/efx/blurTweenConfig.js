// Pure tween configuration for the blur text effect.
//
// Extracted from BlurScrollEffect so the option matrix — scrub vs enter,
// stagger direction, paused, reduced motion — can be tested. The effect class
// itself cannot be: this project's vitest environment is `node`, so there is no
// DOM to split text in and no GSAP to drive it.

import { ENTER_START } from './enterTrigger.js';

export const BLUR_START = 'blur(6px)';
export const BLUR_END = 'blur(0px)';

export const STAGGER_EACH = 0.05;
export const ENTER_DURATION = 0.6;
// Total stagger time, in seconds, spread across however many characters an
// enter-mode tween has. Using `amount` instead of `each` keeps the whole
// entrance's total duration constant regardless of text length — see the
// `mode === 'enter'` branch below.
export const ENTER_STAGGER_AMOUNT = 1.6;

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
		delay,
		paused,
		// Scrub maps the playhead to scroll position, so an ease would fight the
		// scroll; on a self-playing entrance it is what makes it feel deliberate.
		ease: mode === 'enter' ? 'power2.out' : 'none'
	};

	if (mode === 'enter') {
		// `amount` distributes a fixed total across however many chars exist, so
		// total time = duration + amount regardless of character count. `each`
		// (used below for scrub) would instead grow with character count, making
		// long subtitles take far longer to animate in than short titles.
		toVars.stagger = { amount: ENTER_STAGGER_AMOUNT, from };
		// Enter mode always gets a duration for the self-playing animation.
		toVars.duration = ENTER_DURATION;
		// Measured on the running app: fromVars sets willChange to promote a
		// compositor layer for the blur, and the end state leaves an inline
		// `filter: blur(0px)` rather than `none`, so elements never leave the
		// filter path or the promoted layer. Enter only plays once, so clear
		// both on completion to drop the layer and fall off the filter path.
		// Never include `opacity` here — ProjectHeader's title/subtitle rely
		// on a CSS `opacity: 0` rule to stay hidden pre-hydration, and clearing
		// the inline opacity would fall back to that rule and re-hide them.
		// Scrub is excluded entirely (see the `else` branch below): its tween
		// replays in both directions as the user scrolls, so clearing on
		// "completion" would strip willChange/filter and force re-promotion
		// on every scroll-back — churn worse than the leak it would fix.
		toVars.clearProps = 'willChange,filter';
	} else {
		// Scrub maps the whole tween to a scroll range anyway, so a per-character
		// `each` is correct and must stay exactly as it was for the existing
		// scrub consumers (AboutIntro, WorkTeasers).
		toVars.stagger = { each: STAGGER_EACH, from };
	}

	// A paused tween is started by hand — that is the whole point of pausing it.
	// Giving it a ScrollTrigger too would mean two things racing to play it.
	if (paused) return { fromVars, toVars };

	// Non-paused tweens get their scroll trigger.
	if (mode === 'enter') {
		toVars.scrollTrigger = { trigger, start: ENTER_START, once: true };
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
