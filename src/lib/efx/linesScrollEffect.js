// Import the TextSplitter class for handling text splitting.
import { gsap } from 'gsap/dist/gsap';
import { SplitText } from 'gsap/dist/SplitText';


export class LinesScrollEffect {
  constructor(textElement) {
    if (!textElement || !(textElement instanceof HTMLElement)) {
      throw new Error('Invalid text element provided.');
    }

    this.textElement = textElement;

    this.initializeEffect();
  }

  initializeEffect() {
    SplitText.create(this.textElement, {
      type: "lines, chars",
      autoSplit: true,
      onSplit: (instanace) => {
        return gsap.from(instanace.lines, {
          scrollTrigger: {
            trigger: this.textElement,
            start: 'top bottom-=25%',
            end: 'bottom top+=25%',
            scrub: true,
            // markers: true,
          },
          ease: "power2.out",
          // yPercent: 60,
          opacity: 0,
          stagger: 0.15,
        });
      }
    });
  }
}
