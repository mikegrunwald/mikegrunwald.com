// src/lib/actions/__tests__/spotlight.test.js
import { describe, it, expect } from 'vitest';
import { cardLocal } from '../spotlight.js';

describe('cardLocal', () => {
	it('returns pointer position relative to the card top-left', () => {
		const rect = { left: 100, top: 50 };
		expect(cardLocal(rect, 130, 70)).toEqual({ mx: 30, my: 20 });
	});
	it('goes negative when the pointer is left/above the card', () => {
		expect(cardLocal({ left: 100, top: 50 }, 90, 40)).toEqual({ mx: -10, my: -10 });
	});
});
