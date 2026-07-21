import { gsap } from 'gsap/dist/gsap';
import { ScrambleTextPlugin } from 'gsap/dist/ScrambleTextPlugin';
import { prefersReducedMotion } from './reducedMotion.js';

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

		// Nothing to resolve, and an empty scramble target throws.
		if (!original) return;

		this.original = original;
		element.dataset.scrambleOriginal = original;

		if (prefersReducedMotion()) {
			// Already correct in the DOM — no animation, and crucially nothing to
			// undo. This branch exists so the element is never left mid-scramble.
			return;
		}

		this.tween = gsap.to(element, {
			scrambleText: {
				text: original,
				chars: 'upperCase',
				speed: 0.4,
				revealDelay: 0.15
			},
			duration: 0.9,
			ease: 'none',
			scrollTrigger: {
				trigger: element,
				start: 'top bottom-=10%',
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
	}
}
