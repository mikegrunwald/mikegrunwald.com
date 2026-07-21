<script>
	import { onMount } from 'svelte';

	let { src, currentTime = 0, rect, radiusPx = 0, durationMs = 450, onArrived } = $props();

	let el;
	let video;

	onMount(() => {
		// Seed before play so the first painted frame is already the handed-over
		// moment rather than frame 0.
		if (video && Number.isFinite(currentTime) && currentTime > 0) {
			try {
				video.currentTime = currentTime;
			} catch {
				// Seeking can throw if metadata is not loaded yet; starting at 0 is
				// an acceptable outcome and better than failing the transition.
			}
		}
		video?.play?.().catch(() => {}); // autoplay rejection is not fatal

		// Animates left/top/width/height rather than a transform. A transform
		// would be compositor-friendly, but scaling a fullscreen box down to the
		// plane's rect distorts border-radius non-uniformly — and the radius is
		// exactly the detail that has to match the shader at t=0.
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
			{ duration: durationMs, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
		);

		// Resolve on cancel too: the caller gates overlay dismissal on this, so a
		// rejected promise would strand the overlay until the timeout.
		animation.finished.then(() => onArrived?.()).catch(() => onArrived?.());

		// Dev-only trace. Whether the overlay is on screen, growing, and actually
		// showing video frames is not answerable from a screenshot — a video with
		// no decoded frame renders TRANSPARENT, and this element sits under a 95%
		// black gradient, so "invisible" and "absent" look identical.
		let traceId;
		if (import.meta.env.DEV) {
			const samples = [];
			const started = performance.now();
			const sample = () => {
				const r = el.getBoundingClientRect();
				const cs = getComputedStyle(el);
				samples.push({
					ms: Math.round(performance.now() - started),
					w: Math.round(r.width),
					h: Math.round(r.height),
					top: Math.round(r.top),
					left: Math.round(r.left),
					z: cs.zIndex,
					opacity: cs.opacity,
					visibility: cs.visibility,
					// 0 until the browser has decoded a frame — the difference
					// between "not zooming" and "zooming but showing nothing".
					videoW: video?.videoWidth ?? 0,
					readyState: video?.readyState ?? 0,
					paused: video?.paused ?? null
				});
				if (performance.now() - started < durationMs + 200) {
					traceId = requestAnimationFrame(sample);
				}
			};
			window.__transitionTrace = samples;
			traceId = requestAnimationFrame(sample);
		}

		return () => {
			animation.cancel();
			if (traceId) cancelAnimationFrame(traceId);
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
	<video bind:this={video} {src} muted loop playsinline></video>
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

	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
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
