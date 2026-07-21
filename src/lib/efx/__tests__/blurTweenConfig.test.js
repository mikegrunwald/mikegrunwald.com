import { describe, it, expect } from 'vitest';
import { buildBlurTween, BLUR_START, BLUR_END } from '../blurTweenConfig.js';

describe('buildBlurTween defaults (existing scrub behavior)', () => {
	const { fromVars, toVars } = buildBlurTween({ trigger: 'EL' });

	it('starts hidden and blurred', () => {
		expect(fromVars.opacity).toBe(0);
		expect(fromVars.filter).toBe(BLUR_START);
	});

	it('ends visible and sharp', () => {
		expect(toVars.opacity).toBe(1);
		expect(toVars.filter).toBe(BLUR_END);
	});

	it('scrubs against the scroll position', () => {
		expect(toVars.scrollTrigger.scrub).toBe(true);
		expect(toVars.scrollTrigger.trigger).toBe('EL');
		expect(toVars.scrollTrigger.start).toBe('top bottom-=10%');
		expect(toVars.scrollTrigger.end).toBe('bottom center+=15%');
	});

	it('uses a linear ease and no duration, because scrub drives the playhead', () => {
		expect(toVars.ease).toBe('none');
		expect(toVars.duration).toBeUndefined();
	});

	it('staggers from the start', () => {
		expect(toVars.stagger).toEqual({ each: 0.05, from: 'start' });
	});

	it('is not paused', () => {
		expect(toVars.paused).toBe(false);
	});
});

describe('buildBlurTween enter mode', () => {
	const { toVars } = buildBlurTween({ mode: 'enter', trigger: 'EL' });

	it('plays once on entry instead of scrubbing', () => {
		expect(toVars.scrollTrigger.once).toBe(true);
		expect(toVars.scrollTrigger.scrub).toBeUndefined();
	});

	it('has a real duration and an eased curve', () => {
		expect(toVars.duration).toBe(0.9);
		expect(toVars.ease).toBe('power2.out');
	});

	it('drops the scrub-only end marker', () => {
		expect(toVars.scrollTrigger.end).toBeUndefined();
	});
});

describe('buildBlurTween stagger direction', () => {
	it('reverses to right-to-left when from is end', () => {
		const { toVars } = buildBlurTween({ mode: 'enter', from: 'end', trigger: 'EL' });
		expect(toVars.stagger).toEqual({ each: 0.05, from: 'end' });
	});
});

describe('buildBlurTween paused', () => {
	const { toVars } = buildBlurTween({ mode: 'enter', paused: true, delay: 0.15, trigger: 'EL' });

	it('is paused so the caller can start it', () => {
		expect(toVars.paused).toBe(true);
	});

	it('carries the delay', () => {
		expect(toVars.delay).toBe(0.15);
	});

	it('creates no ScrollTrigger, because a paused tween is driven manually', () => {
		expect(toVars.scrollTrigger).toBeUndefined();
	});

	it('still carries the enter duration, so a paused tween does not silently fall back to GSAP default', () => {
		expect(toVars.duration).toBe(0.9);
	});
});

describe('buildBlurTween paused in scrub mode', () => {
	const { toVars } = buildBlurTween({ mode: 'scrub', paused: true, trigger: 'EL' });

	it('sets no duration, because scrub drives the playhead', () => {
		expect(toVars.duration).toBeUndefined();
	});

	it('creates no ScrollTrigger while paused', () => {
		expect(toVars.scrollTrigger).toBeUndefined();
	});
});

describe('buildBlurTween reduced motion', () => {
	const { fromVars, toVars } = buildBlurTween({
		mode: 'enter',
		paused: true,
		delay: 0.15,
		reduceMotion: true,
		trigger: 'EL'
	});

	it('lands on the visible end state', () => {
		expect(toVars.opacity).toBe(1);
		expect(toVars.filter).toBe(BLUR_END);
	});

	it('applies instantly with no delay', () => {
		expect(toVars.duration).toBe(0);
		expect(toVars.delay).toBe(0);
	});

	it('never leaves content hidden', () => {
		expect(fromVars.opacity).toBeUndefined();
	});

	it('is not paused, so it cannot be left un-played', () => {
		expect(toVars.paused).toBe(false);
	});

	it('creates no ScrollTrigger', () => {
		expect(toVars.scrollTrigger).toBeUndefined();
	});

	it('does not stagger', () => {
		expect(toVars.stagger).toBeUndefined();
	});
});
