<script>
	import { onMount, onDestroy } from 'svelte';

	let dot;
	let mouseX = 0;
	let mouseY = 0;
	let dotX = 0;
	let dotY = 0;
	let lastX = 0;
	let lastY = 0;
	const ease = 0.075;
	const dotSize = 16;
	let animationFrame;
	let isTransitioning = false;
	let currentMagneticElement = null;

	function animate() {
		// Magnetic mode
		if (dot && dot.dataset.magnetic === 'true' && currentMagneticElement) {
			// Get fresh position data on every frame to handle scrolling
			const rect = currentMagneticElement.getBoundingClientRect();
			const styles = getComputedStyle(currentMagneticElement);
			const gap = 8;

			const bx = rect.left + gap;
			const by = rect.top + gap;
			const bw = rect.width - gap * 2;
			const bh = rect.height - gap * 2;
			const borderRadius = styles.borderRadius;

			// Smooth interpolation for magnetic positioning
			dotX += (bx + bw / 2 - dotX) * 0.2;
			dotY += (by + bh / 2 - dotY) * 0.2;

			// Current dot size
			const currentW = parseFloat(dot.dataset.currentWidth) || dotSize;
			const currentH = parseFloat(dot.dataset.currentHeight) || dotSize;

			// Smooth size interpolation
			const newW = currentW + (bw - currentW) * 0.2;
			const newH = currentH + (bh - currentH) * 0.2;

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

		const isBig = dot.classList.contains('cursor-dot--big');
		const scale = isBig ? 2.6 : 1;
		const sx = 1 + stretch;
		const sy = 1 - stretch;

		dot.style.transform = `
			translate(${dotX}px, ${dotY}px)
			translate(-50%, -50%)
			rotate(${angle}rad)
			scale(${sx * scale}, ${sy * scale})
		`;

		animationFrame = requestAnimationFrame(animate);
	}

	function bindHoverState() {
		const selector = "a, button, input, textarea, select, [role='button'], [data-cursor]";
		const els = document.querySelectorAll(selector);

		console.log(`CursorDot: Found ${els.length} interactive elements`);

		els.forEach((el) => {
			if (el.dataset.cursorBound) return;
			el.dataset.cursorBound = '1';

			console.log('CursorDot: Binding element:', el, 'cursor mode:', el.dataset.cursor);

			el.addEventListener('mouseenter', () => {
				const mode = el.dataset.cursor;
				console.log('CursorDot: Mouse enter, mode:', mode);

				if (mode === 'magnetic') {
					console.log('CursorDot: Magnetic mode activated');
					currentMagneticElement = el;
					dot.dataset.magnetic = 'true';
					dot.classList.add('cursor-dot--magnetic');
				} else {
					console.log('CursorDot: Big mode activated');
					dot.classList.add('cursor-dot--big');
				}
			});

			el.addEventListener('mouseleave', () => {
				console.log('CursorDot: Mouse leave');
				dot.classList.remove('cursor-dot--big');
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
		const moveHandler = (e) => {
			mouseX = e.clientX;
			mouseY = e.clientY;
			if (dot) dot.style.opacity = '0.95';
		};
		const leaveHandler = () => {
			if (dot) dot.style.opacity = '0';
		};
		const touchHandler = () => {
			if (dot) dot.style.opacity = '0';
		};

		window.addEventListener('mousemove', moveHandler, { passive: true });
		window.addEventListener('mouseleave', leaveHandler);
		window.addEventListener('touchstart', touchHandler, { passive: true });

		const mo = new MutationObserver(() => bindHoverState());
		mo.observe(document.body, { childList: true, subtree: true });
		bindHoverState();

		animationFrame = requestAnimationFrame(animate);

		onDestroy(() => {
			window.removeEventListener('mousemove', moveHandler);
			window.removeEventListener('mouseleave', leaveHandler);
			window.removeEventListener('touchstart', touchHandler);
			mo.disconnect();
			cancelAnimationFrame(animationFrame);
		});
	});
</script>

<div class="cursor-dot" bind:this={dot} aria-hidden="true"></div>

<style>
	.cursor-dot {
		/* --dot-size: 16px; */

		position: fixed;
		left: 0;
		top: 0;
		/* width: var(--dot-size);
		height: var(--dot-size); */
		border-radius: 50%;
		background: var(--color-black);
		box-shadow: 0 0 8px rgba(0, 0, 0, 0.08);
		transform: translate(-50%, -50%) scale(1);
		pointer-events: none;
		/* z-index: 9999; */
		transition:
			opacity 200ms,
			border-radius 200ms;
		will-change: transform, opacity;
		opacity: 0.666;
	}

	.cursor-dot--magnetic {
		opacity: 1;
		border-radius: inherit;
	}

	@media (pointer: coarse) {
		.cursor-dot {
			display: none;
		}
	}
</style>
