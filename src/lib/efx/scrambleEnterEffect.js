import { gsap } from 'gsap/dist/gsap';
import { ScrambleTextPlugin } from 'gsap/dist/ScrambleTextPlugin';
import { prefersReducedMotion } from './reducedMotion.js';
import { ENTER_START } from './enterTrigger.js';

// ScrollTrigger is deliberately NOT imported or registered here. `+layout.svelte`
// already registers it app-wide, from the `gsap/ScrollTrigger` specifier — and
// that is a DIFFERENT module instance from `gsap/dist/ScrollTrigger`. Importing
// the dist path here would create a second ScrollTrigger with its own trigger
// registry and its own scroll listener, so `ScrollTrigger.getAll()` would report
// only half the triggers and teardown checks would silently miss leaks. The
// sibling effects (blurScrollEffect, linesScrollEffect) rely on the same ambient
// registration. ScrambleTextPlugin is different: nothing else registers it.
gsap.registerPlugin(ScrambleTextPlugin);

// Resolves random glyphs into the element's real text when it scrolls into view.
//
// Only safe on monospace text. The plugin rewrites textContent in place, so a
// proportional font would reflow on every frame; the meta values are
// `--font-family-mono`, which is what makes this cause zero layout shift. The
// scramble also preserves character count for the same reason — do not swap in
// a config that changes length mid-tween.
export class ScrambleEnterEffect {
	constructor(element) {
		if (!element || !(element instanceof HTMLElement)) {
			throw new Error('Invalid element provided.');
		}

		this.element = element;
		this.tween = null;
		this.original = null;
		// ScrambleTextPlugin rewrites textContent frame by frame, so a second effect
		// constructed on this element mid-tween would capture a half-scrambled string
		// and then resolve the element to it permanently. Cache the pristine value on
		// first sight so every later construction recovers the real text, not whatever
		// the previous tween happened to be displaying.
		const original = element.dataset.scrambleOriginal ?? element.textContent;

		// Nothing to resolve, and an empty scramble target throws. The CSS rule
		// hides .scramble-target from first paint, so even an empty/whitespace
		// value must still be revealed here — otherwise this early return would
		// leave the element permanently invisible.
		if (!original) {
			gsap.set(element, { opacity: 1 });
			return;
		}

		this.original = original;
		element.dataset.scrambleOriginal = original;

		if (prefersReducedMotion()) {
			// Already correct in the DOM — no animation, and crucially nothing to
			// undo. This branch exists so the element is never left mid-scramble.
			// Still must reveal it: the CSS rule hides it from first paint, and no
			// tween is created on this path to do it for us.
			gsap.set(element, { opacity: 1 });
			return;
		}

		this.tween = gsap.to(element, {
			scrambleText: {
				text: original,
				chars: 'lowerCase',
				speed: 0.6,
				revealDelay: 0.2
			},
			duration: 2.4,
			ease: 'none',
			// The CSS rule hides .scramble-target from first paint; reveal it at
			// the exact moment the scramble begins so no finished text is ever
			// visible beforehand.
			onStart: () => gsap.set(element, { opacity: 1 }),
			scrollTrigger: {
				trigger: element,
				start: ENTER_START,
				once: true
			}
		});
	}

	destroy() {
		// The ScrollTrigger is the thing that leaks; killing the tween alone does
		// not necessarily take it. Same failure this codebase already hit with
		// BlurScrollEffect.
		this.tween?.scrollTrigger?.kill();
		this.tween?.kill();
		this.tween = null;

		// Nothing was ever cached in the empty-text case (constructor's first
		// early return) — there is nothing to restore or remove.
		if (this.original === null) return;

		// Restore the DOM: leaving whatever random glyphs were on screen mid-tween
		// behind, and leaving data-scramble-original on the element, is the same
		// class of bug BlurScrollEffect.destroy() avoids via split.revert().
		this.element.textContent = this.original;
		delete this.element.dataset.scrambleOriginal;
		this.original = null;
		// Torn down mid-animation (e.g. before its ScrollTrigger ever fired) must
		// not leave the CSS opacity: 0 rule in place with nothing left running to
		// clear it.
		gsap.set(this.element, { opacity: 1 });
	}
}
