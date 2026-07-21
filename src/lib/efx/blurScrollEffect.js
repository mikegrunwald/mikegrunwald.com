import { gsap } from 'gsap/dist/gsap';
import { SplitText } from 'gsap/dist/SplitText';
import { buildBlurTween } from './blurTweenConfig.js';
import { prefersReducedMotion } from './reducedMotion.js';

export class BlurScrollEffect {
  // options: { mode: 'scrub'|'enter', from: 'start'|'end', delay: number,
  //            paused: boolean }. The defaults reproduce the original
  //            scroll-scrubbed, left-to-right behavior exactly, so the existing
  //            callers (AboutIntro, WorkTeasers) need no change.
  constructor(textElement, options = {}) {
    if (!textElement || !(textElement instanceof HTMLElement)) {
      throw new Error('Invalid text element provided.');
    }

    this.textElement = textElement;
    this.options = options;
    this.destroyed = false;
    this.split = null;
    // Set once the tween exists. A caller can call play() before fonts resolve
    // — the transition overlay can be dismissed that fast — so the request has
    // to be remembered rather than dropped.
    this.playRequested = false;
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
        // Rebuilt per split rather than hoisted out of this callback. GSAP takes
        // ownership of the vars objects it is handed — including the nested
        // scrollTrigger config — so reusing one instance across the re-splits
        // that autoSplit performs on resize and font swap would hand GSAP an
        // object a previous tween had already mutated.
        const { fromVars, toVars } = buildBlurTween({
          ...this.options,
          reduceMotion: prefersReducedMotion(),
          trigger: this.textElement
        });

        const tween = gsap.fromTo(instance.chars, fromVars, toVars);
        this.tweens.add(tween);
        // A play() that arrived before the split — or before a re-split — must
        // still take effect, otherwise the text stays at opacity 0 forever.
        if (this.playRequested) tween.play();
        // Returned so SplitText reverts it before re-splitting (GSAP contract).
        return tween;
      }
    });
  }

  // Starts a tween built with `paused: true`. Safe to call at any time and any
  // number of times, including before the split has happened.
  play() {
    this.playRequested = true;
    for (const tween of this.tweens) tween.play();
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
