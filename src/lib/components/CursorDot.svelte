<script module>
	// External magnetic target for the cursor dot — set by CarouselScene (Task 6)
	// to the hovered ring plane's projected screen rect so the DOM dot morphs to
	// and follows the 3D teaser as the ring rotates, reusing the existing
	// magnetic-follow animation instead of rendering a cursor into the WebGPU
	// canvas (which sits behind all page content and would draw behind the text).
	//
	// Shape: { x, y, width, height, radius } — x/y are the CENTER in CSS px, or
	// null to release. The instance's animate() loop reads this every frame; the
	// setter only stores the value (no DOM access here — it's module scope), so
	// it's safe to call before/after the component mounts and on touch devices
	// where the instance never starts its RAF loop.
	let externalTarget = null;

	export function setExternalMagneticTarget(target) {
		externalTarget = target;
	}
</script>

<script>
	import { onMount, onDestroy } from 'svelte';

	let dot;
	// Tracks the previous frame's external-target presence so animate() can fire
	// the enter (add magnetic class) / leave (start return transition) edges that
	// mouseenter/mouseleave handle for real DOM magnetic elements.
	let prevExternalActive = false;
	let mouseX = 0;
	let mouseY = 0;
	let dotX = 0;
	let dotY = 0;
	let lastX = 0;
	let lastY = 0;
	const ease = 0.0333;
	const dotSize = 16;
	let animationFrame;
	let isTransitioning = false;
	let currentMagneticElement = null;

	function animate() {
		// External (3D carousel) magnetic target — detect enter/leave edges here,
		// since unlike DOM elements there's no mouseenter/mouseleave to drive them.
		const externalActive = !!externalTarget;
		if (dot) {
			if (externalActive && !prevExternalActive) {
				dot.dataset.magnetic = 'true';
				dot.classList.add('cursor-dot--magnetic');
				isTransitioning = false;
			} else if (!externalActive && prevExternalActive) {
				dot.classList.remove('cursor-dot--magnetic');
				isTransitioning = true; // smooth return to the normal dot
				delete dot.dataset.magnetic;
			}
			prevExternalActive = externalActive;
		}

		// Magnetic mode — an external 3D target takes priority over a DOM element.
		if (dot && (externalActive || (dot.dataset.magnetic === 'true' && currentMagneticElement))) {
			const gap = 8;
			let bx, by, bw, bh, borderRadius;
			if (externalActive) {
				// externalTarget.x/y are the rect CENTRE in CSS px; inset by `gap`
				// to match how the DOM path insets getBoundingClientRect.
				bw = externalTarget.width - gap * 2;
				bh = externalTarget.height - gap * 2;
				bx = externalTarget.x - externalTarget.width / 2 + gap;
				by = externalTarget.y - externalTarget.height / 2 + gap;
				borderRadius = `${externalTarget.radius ?? 8}px`;
			} else {
				// Get fresh position data on every frame to handle scrolling
				const rect = currentMagneticElement.getBoundingClientRect();
				const styles = getComputedStyle(currentMagneticElement);
				bx = rect.left + gap;
				by = rect.top + gap;
				bw = rect.width - gap * 2;
				bh = rect.height - gap * 2;
				borderRadius = styles.borderRadius;
			}

			// Smooth interpolation for magnetic positioning
			dotX += (bx + bw / 2 - dotX) * 0.1;
			dotY += (by + bh / 2 - dotY) * 0.1;

			// Current dot size
			const currentW = parseFloat(dot.dataset.currentWidth) || dotSize;
			const currentH = parseFloat(dot.dataset.currentHeight) || dotSize;

			// Smooth size interpolation
			const newW = currentW + (bw - currentW) * 0.1;
			const newH = currentH + (bh - currentH) * 0.1;

			// Store current size for next frame
			dot.dataset.currentWidth = newW;
			dot.dataset.currentHeight = newH;

			// Apply actual dimensions and border radius
			dot.style.width = `${newW}px`;
			dot.style.height = `${newH}px`;
			dot.style.borderRadius = borderRadius;
			dot.style.transform = `
				translate(${dotX}px, ${dotY}px)
				translate(-50%, -50%)
			`;

			animationFrame = requestAnimationFrame(animate);
			return;
		}

		// Transitioning mode - smooth return to normal state
		if (isTransitioning) {
			const currentW = parseFloat(dot.dataset.currentWidth) || dotSize;
			const currentH = parseFloat(dot.dataset.currentHeight) || dotSize;

			// Smooth interpolation back to normal size
			const newW = currentW + (dotSize - currentW) * 0.15;
			const newH = currentH + (dotSize - currentH) * 0.15;

			// Store current size for next frame
			dot.dataset.currentWidth = newW;
			dot.dataset.currentHeight = newH;

			// Apply size and gradually transition border radius
			dot.style.width = `${newW}px`;
			dot.style.height = `${newH}px`;

			// During transition, follow cursor but NO rotation or stretching
			dotX += (mouseX - dotX) * ease;
			dotY += (mouseY - dotY) * ease;

			// Simple transform - only position, no rotation or scale
			dot.style.transform = `
				translate(${dotX}px, ${dotY}px)
				translate(-50%, -50%)
			`;

			// Check if we're close enough to normal size to stop transitioning
			if (Math.abs(newW - dotSize) < 0.5 && Math.abs(newH - dotSize) < 0.5) {
				isTransitioning = false;
				dot.style.width = `${dotSize}px`;
				dot.style.height = `${dotSize}px`;
				dot.style.borderRadius = '50%';
				delete dot.dataset.currentWidth;
				delete dot.dataset.currentHeight;
				// Reset velocity tracking for smooth transition to normal mode
				lastX = dotX;
				lastY = dotY;
			}

			animationFrame = requestAnimationFrame(animate);
			return;
		}

		// Normal dot mode - ensure proper size if not transitioning
		if (!isTransitioning && !dot.dataset.magnetic && dot.style.width !== `${dotSize}px`) {
			dot.style.width = `${dotSize}px`;
			dot.style.height = `${dotSize}px`;
			dot.style.borderRadius = '50%';
		}

		dotX += (mouseX - dotX) * ease;
		dotY += (mouseY - dotY) * ease;

		const vx = dotX - lastX;
		const vy = dotY - lastY;
		lastX = dotX;
		lastY = dotY;

		const speed = Math.sqrt(vx * vx + vy * vy);
		const angle = Math.atan2(vy, vx);
		const stretch = Math.min(speed * 0.05, 0.35);

		const sx = 1 + stretch;
		const sy = 1 - stretch;

		dot.style.transform = `
			translate(${dotX}px, ${dotY}px)
			translate(-50%, -50%)
			rotate(${angle}rad)
			scale(${sx}, ${sy})
		`;

		animationFrame = requestAnimationFrame(animate);
	}

	function bindHoverState() {
		const selector = "a, button, input, textarea, select, [role='button'], [data-cursor]";
		const els = document.querySelectorAll(selector);

		els.forEach((el) => {
			if (el.dataset.cursorBound) return;
			el.dataset.cursorBound = '1';

			el.addEventListener('mouseenter', () => {
				const mode = el.dataset.cursor;

				if (mode === 'magnetic') {
					currentMagneticElement = el;
					dot.dataset.magnetic = 'true';
					dot.classList.add('cursor-dot--magnetic');
				}
			});

			el.addEventListener('mouseleave', () => {
				dot.classList.remove('cursor-dot--magnetic');

				// If leaving magnetic mode, start smooth transition
				if (dot.dataset.magnetic === 'true') {
					isTransitioning = true;
				}

				currentMagneticElement = null;
				delete dot.dataset.magnetic;
			});
		});
	}

	onMount(() => {
		// Check if device has coarse pointer (touch device)
		const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

		// Don't initialize on touch devices - saves RAF loop
		if (isTouchDevice) {
			return;
		}

		const moveHandler = (e) => {
			mouseX = e.clientX;
			mouseY = e.clientY;
		};

		window.addEventListener('mousemove', moveHandler, { passive: true });

		const mo = new MutationObserver(() => bindHoverState());
		mo.observe(document.body, { childList: true, subtree: true });
		bindHoverState();

		animationFrame = requestAnimationFrame(animate);

		onDestroy(() => {
			window.removeEventListener('mousemove', moveHandler);
			mo.disconnect();
			cancelAnimationFrame(animationFrame);
		});
	});
</script>

<div class="cursor-dot" bind:this={dot} aria-hidden="true"></div>

<style>
	.cursor-dot {
		position: fixed;
		left: 0;
		top: 0;
		background: var(--color-black);
		box-shadow: 0 0 16px 0 #33c5f3;
		border-radius: 50%;
		transform: translate(-50%, -50%) scale(1);
		pointer-events: none;
		transition:
			opacity 500ms,
			border-radius 300ms;
		will-change: transform, opacity;
		opacity: 0.666;
		z-index: 100;
	}

	:global(.cursor-dot.cursor-dot--magnetic) {
		z-index: unset;
		opacity: 1 !important;
	}

	@media (pointer: coarse) {
		.cursor-dot {
			display: none;
			z-index: unset;
		}
	}
</style>
