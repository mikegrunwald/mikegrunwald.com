import { describe, it, expect } from 'vitest';
import { pickQuality } from '../engine.js';

const DESKTOP_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const ANDROID_UA =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148';

describe('pickQuality', () => {
	it('desktop keeps DYE_RESOLUTION 1024 and caps dpr at 2', () => {
		const q = pickQuality({ userAgent: DESKTOP_UA, devicePixelRatio: 3 });
		expect(q.tier).toBe('desktop');
		expect(q.dyeResolution).toBe(1024);
		expect(q.dpr).toBe(2);
	});
	it('android is mobile tier with DYE_RESOLUTION 512 (parity with WebGLFluid.js:89-91)', () => {
		const q = pickQuality({ userAgent: ANDROID_UA, devicePixelRatio: 2.6 });
		expect(q.tier).toBe('mobile');
		expect(q.dyeResolution).toBe(512);
		expect(q.dpr).toBe(2);
	});
	it('iOS is mobile tier (Mobi matches)', () => {
		expect(pickQuality({ userAgent: IOS_UA, devicePixelRatio: 3 }).tier).toBe('mobile');
	});
	it('low-dpr devices keep their native dpr', () => {
		expect(pickQuality({ userAgent: DESKTOP_UA, devicePixelRatio: 1 }).dpr).toBe(1);
	});
});
