// Import the TextSplitter class for handling text splitting.
import { gsap } from 'gsap/dist/gsap';
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { SplitText } from 'gsap/dist/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);


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
        console.log('split lines: ');
        return gsap.from(instanace.lines, {
          scrollTrigger: {
            trigger: this.textElement,
            toggleActions: "restart pause resume reverse",
            start: 'top bottom-=25%',
            end: 'bottom top+=25%',
            // markers: true,
          },
          duration: 0.5,
          ease: "power2.out",
          // yPercent: 60,
          opacity: 0,
          stagger: 0.15,
        });
      }
    });
  }
}
