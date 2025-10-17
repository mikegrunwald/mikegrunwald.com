import { gsap } from 'gsap/dist/gsap';
import { SplitText } from 'gsap/dist/SplitText';


export class BlurScrollEffect {
  constructor(textElement) {
    if (!textElement || !(textElement instanceof HTMLElement)) {
      throw new Error('Invalid text element provided.');
    }

    this.textElement = textElement;

    document.fonts.ready.then(() => {
      this.initializeEffect();
    });
  }


  initializeEffect() {
    SplitText.create(this.textElement, {
      type: 'words, chars',
      autoSplit: true,
      onSplit: (instance) => {
        return gsap.fromTo(instance.chars, {
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
      }
    });
  }
}
