// Import the TextSplitter class for handling text splitting.
import { gsap } from 'gsap/dist/gsap';
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { TextSplitter } from '$lib/textSplitter.js';

gsap.registerPlugin(ScrollTrigger);


export class LinesScrollEffect {
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
            splitTypeTypes: 'lines'
        });

        this.scroll();
    }

    scroll() {
        const lines = this.splitter.getLines();

        gsap.from(lines, {
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
}
