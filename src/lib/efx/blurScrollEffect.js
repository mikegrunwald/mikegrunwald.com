// Import the TextSplitter class for handling text splitting.
import { gsap } from 'gsap/dist/gsap';
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { TextSplitter } from '$lib/textSplitter.js';

gsap.registerPlugin(ScrollTrigger);


export class BlurScrollEffect {
  constructor(textElement) {
    if (!textElement || !(textElement instanceof HTMLElement)) {
      throw new Error('Invalid text element provided.');
    }

    this.textElement = textElement;

    this.initializeEffect();
  }

  initializeEffect() {
    const textResizeCallback = () => this.scroll();

    this.splitter = new TextSplitter(this.textElement, {
      resizeCallback: textResizeCallback,
      splitTypeTypes: 'words, chars'
    });

    this.scroll();
  }

  scroll() {
    const chars = this.splitter.getChars();

    gsap.fromTo(chars, {
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
}
