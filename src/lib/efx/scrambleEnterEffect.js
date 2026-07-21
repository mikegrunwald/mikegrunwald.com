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
		// Captured before the plugin ever touches textContent. Reading it later
		// would capture a half-scrambled string as the target.
		const original = element.textContent;

		// Nothing to resolve, and an empty scramble target throws.
		if (!original) return;

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
	}
}
