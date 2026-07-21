import { gsap } from 'gsap/dist/gsap';
import { prefersReducedMotion } from './reducedMotion.js';

// ScrollTrigger is deliberately NOT imported or registered here — `+layout.svelte`
// registers it app-wide from the `gsap/ScrollTrigger` specifier, which is a
// different module instance from `gsap/dist/ScrollTrigger`. See the note in
// scrambleEnterEffect.js. Passing `scrollTrigger` in tween vars is all that is
// needed, which is what blurScrollEffect and linesScrollEffect already do.

// Rises a group of elements into place, one after another, on scroll-in.
//
// Animates `top` rather than `y`/transform because the spec calls for a
// percentage offset resolved against the element's own height — which is what
// `top: 50%` means on a positioned element, and is roughly a half-line rise.
// The elements MUST be `position: relative` or `top` silently does nothing.
export class StaggerEnterEffect {
	constructor(elements) {
		this.elements = Array.from(elements ?? []);
		this.tween = null;

		if (this.elements.length === 0) return;

		if (prefersReducedMotion()) {
			// Land on the end state directly. Nothing is ever set to opacity 0, so
			// there is no way to leave the content invisible.
			gsap.set(this.elements, { opacity: 1, top: 0 });
			return;
		}

		this.tween = gsap.fromTo(
			this.elements,
			{ opacity: 0, top: '50%' },
			{
				opacity: 1,
				top: 0,
				duration: 0.6,
				ease: 'power2.out',
				stagger: 0.06,
				scrollTrigger: {
					// Triggered off the first element rather than each individually:
					// these sit on one row, so per-element triggers would fire at
					// effectively the same moment and fight the stagger.
					trigger: this.elements[0],
					start: 'top bottom-=10%',
					once: true
				}
			}
		);
	}

	destroy() {
		this.tween?.scrollTrigger?.kill();
		this.tween?.kill();
		this.tween = null;
	}
}
