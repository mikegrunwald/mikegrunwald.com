<script>
	import { onMount } from 'svelte';
	import { coverRect } from '$lib/gpu/carousel/coverFit.js';

	// `sourceVideo` is the carousel's OWN <video> element — already decoded and
	// playing. We paint it into a canvas rather than mounting a second <video>
	// with the same src: a fresh element takes ~460ms just to reach metadata,
	// which is longer than this entire animation, so it renders transparent for
	// the whole zoom. Measured, not assumed.
	let { sourceVideo, rect, radiusPx = 0, durationMs = 450, onArrived } = $props();

	let el;
	let canvas;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		let rafId;

		// Dev-only trace, folded into the paint loop rather than given its own
		// rAF. The overlay's visibility depends entirely on the SOURCE video
		// having decoded frames — an undecoded one paints nothing, which is
		// indistinguishable from the overlay being absent. That is exactly how
		// the first version failed, so the signal is worth keeping.
		const trace = import.meta.env.DEV ? [] : null;
		const startedAt = performance.now();
		if (trace) window.__transitionTrace = trace;

		const paint = () => {
			const srcW = sourceVideo?.videoWidth ?? 0;
			const srcH = sourceVideo?.videoHeight ?? 0;
			const box = el.getBoundingClientRect();
			const cssW = Math.max(1, Math.round(box.width));
			const cssH = Math.max(1, Math.round(box.height));
			// Backing store in DEVICE pixels, not CSS pixels. The canvas is sized
			// by CSS to fill the element, so a CSS-pixel backing store is upscaled
			// by the device pixel ratio — a visibly soft video on any retina
			// display. Capped because the overlay reaches fullscreen: on a 5K
			// screen at dpr 2 an uncapped buffer is ~4x the pixels of the source
			// video, which costs memory to gain nothing.
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			const dstW = Math.round(cssW * dpr);
			const dstH = Math.round(cssH * dpr);

			// Reassigning width/height clears the canvas, so only do it on an
			// actual change — the box changes every frame during the zoom.
			if (canvas.width !== dstW || canvas.height !== dstH) {
				canvas.width = dstW;
				canvas.height = dstH;
			}

			if (srcW > 0 && srcH > 0) {
				// Crop against the DISPLAYED aspect, which is identical either way,
				// then draw across the full device-pixel buffer.
				const c = coverRect({ srcW, srcH, dstW: cssW, dstH: cssH });
				ctx.drawImage(sourceVideo, c.sx, c.sy, c.sw, c.sh, 0, 0, dstW, dstH);
			}

			if (trace && trace.length < 240) {
				trace.push({
					ms: Math.round(performance.now() - startedAt),
					w: cssW,
					h: cssH,
					srcW,
					srcReadyState: sourceVideo?.readyState ?? 0,
					srcPaused: sourceVideo?.paused ?? null,
					srcTime: +(sourceVideo?.currentTime ?? 0).toFixed(2)
				});
			}
			rafId = requestAnimationFrame(paint);
		};
		paint();

		// Eased so the travel is visible across the whole duration. The previous
		// curve reached ~70% of final size by 18ms — 4% of the duration — which
		// reads as a pop rather than a zoom even when the image is visible.
		const animation = el.animate(
			[
				{
					left: `${rect.x - rect.width / 2}px`,
					top: `${rect.y - rect.height / 2}px`,
					width: `${rect.width}px`,
					height: `${rect.height}px`,
					borderRadius: `${radiusPx}px`,
					boxShadow: '0 0 16px 0 #33c5f3, inset 0 0 12px #33c5f3'
				},
				{
					left: '0px',
					top: '0px',
					width: '100vw',
					height: '100dvh',
					borderRadius: '0px',
					boxShadow: '0 0 0 0 rgba(51, 197, 243, 0)'
				}
			],
			{ duration: durationMs, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'forwards' }
		);

		// Resolve on cancel too: the caller gates overlay dismissal on this, so a
		// rejected promise would strand the overlay until the timeout.
		animation.finished.then(() => onArrived?.()).catch(() => onArrived?.());

		return () => {
			animation.cancel();
			cancelAnimationFrame(rafId);
		};
	});
</script>

<div
	class="transition-video"
	bind:this={el}
	style:left="{rect.x - rect.width / 2}px"
	style:top="{rect.y - rect.height / 2}px"
	style:width="{rect.width}px"
	style:height="{rect.height}px"
	style:border-radius="{radiusPx}px"
	aria-hidden="true"
>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.transition-video {
		position: fixed;
		z-index: 400; /* above the cursor dot's 300 */
		overflow: hidden;
		pointer-events: none;
		box-shadow:
			0 0 16px 0 #33c5f3,
			inset 0 0 12px #33c5f3;
	}

	canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	/* The same vertical gradient ProjectHeader's :after applies, so the overlay's
	   end state IS the detail page's header framing rather than something that
	   has to cross-fade into it. */
	.transition-video::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			in oklch to bottom,
			rgba(0, 0, 0, 0.95) 0%,
			rgba(0, 0, 0, 0.666) 50%,
			rgba(0, 0, 0, 0.95) 100%
		);
	}
</style>
