import { gsap } from 'gsap/dist/gsap';
import { SplitText } from 'gsap/dist/SplitText';


export class BlurScrollEffect {
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
      type: 'words, chars',
      autoSplit: true,
      onSplit: (instance) => {
        const tween = gsap.fromTo(instance.chars, {
          opacity: 0,
          // x: -20,
          // filter: 'blur(30px) brightness(0%)',
          filter: 'blur(6px)',
          willChange: 'opacity, x, y, filter'
        }, {
          ease: 'none',
          // filter: 'blur(0px) brightness(100%)',
          filter: 'blur(0px)',
          opacity: 1,
          // x: 0,
          stagger: 0.05,
          scrollTrigger: {
            trigger: this.textElement,
            start: 'top bottom-=10%',
            end: 'bottom center+=15%',
            scrub: true,
            // markers: true
          },
        });
        this.tweens.add(tween);
        // Returned so SplitText reverts it before re-splitting (GSAP contract).
        return tween;
      }
    });
  }

  // Callers MUST invoke this on unmount. Passing `scrollTrigger` to gsap.fromTo()
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
