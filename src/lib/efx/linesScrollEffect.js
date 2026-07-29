import { gsap } from 'gsap/dist/gsap';
import { SplitText } from 'gsap/dist/SplitText';

export class LinesScrollEffect {
	constructor(textElement) {
		if (!textElement || !(textElement instanceof HTMLElement)) {
			throw new Error('Invalid text element provided.');
		}

		this.textElement = textElement;
		this.destroyed = false;
		this.split = null;
		// onSplit fires again on every re-split (autoSplit re-splits on resize and
		// font swaps), each time creating a NEW tween + ScrollTrigger, so collect
		// them all rather than keeping only the latest.
		this.tweens = new Set();

		document.fonts.ready.then(() => {
			// The component can unmount before fonts resolve. Without this guard the
			// effect would still initialize, splitting and attaching a ScrollTrigger
			// to an element that is no longer in the document.
			if (this.destroyed) return;
			this.initializeEffect();
		});
	}

	initializeEffect() {
		this.split = SplitText.create(this.textElement, {
			type: 'lines, words, chars',
			autoSplit: true,
			deepSlice: false,
			onSplit: (instanace) => {
				const tween = gsap.from(instanace.lines, {
					scrollTrigger: {
						trigger: this.textElement,
						start: 'top bottom-=25%',
						end: 'bottom top+=25%',
						scrub: true
						// markers: true,
					},
					ease: 'power2.out',
					// yPercent: 60,
					opacity: 0,
					stagger: 0.15
				});
				this.tweens.add(tween);
				// Returned so SplitText reverts it before re-splitting (GSAP contract).
				return tween;
			}
		});
	}

	// Callers MUST invoke this on unmount. Passing `scrollTrigger` to gsap.from()
	// makes GSAP implicitly create a ScrollTrigger, and nothing kills it when the
	// component goes away — on a client-side nav away and back the old instances
	// stayed alive (with stale positions computed against the previous document)
	// while a fresh set was created, doubling the count on every round trip.
	destroy() {
		this.destroyed = true;
		for (const tween of this.tweens) {
			// Kill the trigger explicitly: killing a tween does not necessarily take
			// its attached ScrollTrigger with it, and the trigger is the thing that
			// leaks. Both calls are safe if SplitText already reverted the tween.
			tween.scrollTrigger?.kill();
			tween.kill();
		}
		this.tweens.clear();
		// Restores the original DOM and detaches SplitText's own resize handling.
		this.split?.revert();
		this.split = null;
	}
}
