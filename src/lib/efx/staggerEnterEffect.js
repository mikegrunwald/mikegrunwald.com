import { gsap } from 'gsap/dist/gsap';
import { prefersReducedMotion } from './reducedMotion.js';
import { ENTER_START } from './enterTrigger.js';

// ScrollTrigger is deliberately NOT imported or registered here — `+layout.svelte`
// registers it app-wide from the `gsap/ScrollTrigger` specifier, which is a
// different module instance from `gsap/dist/ScrollTrigger`. See the note in
// scrambleEnterEffect.js. Passing `scrollTrigger` in tween vars is all that is
// needed, which is what blurScrollEffect and linesScrollEffect already do.

// Rises a group of elements into place, one after another, on scroll-in.
//
// Animates `yPercent` rather than `top` because the spec calls for a
// percentage offset resolved against the element's own height — and
// `yPercent` resolves against the element's own height too, but as a
// composited transform rather than a layout-forcing property. It also needs
// no positioning context, so the effect has no CSS precondition.
export class StaggerEnterEffect {
	constructor(elements) {
		this.elements = Array.from(elements ?? []);
		this.tween = null;

		if (this.elements.length === 0) return;

		if (prefersReducedMotion()) {
			// Land on the end state directly. Nothing is ever set to opacity 0, so
			// there is no way to leave the content invisible.
			gsap.set(this.elements, { opacity: 1, yPercent: 0 });
			return;
		}

		this.tween = gsap.fromTo(
			this.elements,
			{ opacity: 0, yPercent: 50 },
			{
				opacity: 1,
				yPercent: 0,
				duration: 0.6,
				ease: 'power2.out',
				stagger: 0.06,
				scrollTrigger: {
					// Triggered off the first element rather than each individually:
					// these sit on one row, so per-element triggers would fire at
					// effectively the same moment and fight the stagger.
					trigger: this.elements[0],
					start: ENTER_START,
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
