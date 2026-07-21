<script>
	import { BlurScrollEffect } from '$lib/efx/blurScrollEffect.js';
	import { LinesScrollEffect } from '$lib/efx/linesScrollEffect.js';
	import { onMount, onDestroy, tick } from 'svelte';

	let intro;
	// Retained so they can be torn down on unmount. Each effect implicitly
	// creates a ScrollTrigger, which is NOT garbage collected when the component
	// goes away — GSAP keeps its own global registry. Dropping the references
	// leaked 6 triggers per visit: navigating away and back left the old set
	// alive (holding stale positions measured against the previous document)
	// alongside a fresh set, doubling on every round trip.
	let effects = [];

	onMount(async () => {
		await tick();

		intro.querySelectorAll('.display').forEach((display) => {
			effects.push(new BlurScrollEffect(display));
		});

		intro.querySelectorAll('.lines').forEach((line) => {
			effects.push(new LinesScrollEffect(line));
		});
	});

	onDestroy(() => {
		// Also covers unmounting before `document.fonts.ready` resolves — destroy()
		// sets a flag the pending init checks, so no trigger is created after this.
		for (const effect of effects) effect.destroy();
		effects = [];
	});
</script>

<article class="about-intro" id="about" bind:this={intro}>
	<h2 class="display">Design Engineer / Frontend Developer</h2>
	<p class="lines intro">
		With almost 2 decades of experience, I specialize in crafting award-winning user interfaces and
		web applications that bring complex designs to life. Across industries, I transform intricate
		user experiences into engaging, high-performing digital solutions.
	</p>
	<h3 class="display">Innovative Solutions for Recognized Brands</h3>
	<p class="lines intro-secondary">
		I've developed creative work for brands like <strong>Google</strong>, <strong>Spotify</strong>,
		<strong>TikTok</strong>, <strong>Patreon</strong>, <strong>IBM</strong>, <strong>Kia</strong>,
		<strong>Accenture</strong>, <strong>Delta Airlines</strong>, <strong>Hubspot</strong>, and
		<strong>GE Healthcare</strong>. Whether building virtual conferences or optimizing workflows, I
		combine technical expertise and an innovative mindset to solve challenges with clean, impactful
		code.
	</p>
	<h3 class="display">Passion for Aesthetic and Functional Design</h3>
	<p class="lines intro-secondary">
		I'm driven to marry aesthetics with functionality, blending technical prowess and design
		sensibility to create visually stunning, highly intuitive and performant web experiences.
	</p>
</article>

<style>
	.about-intro {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		padding: var(--spacing-base);
		position: relative;
		z-index: 1;

		@media (max-width: 768px) {
			padding: var(--spacing-base) var(--spacing-xs);
		}
	}

	.display {
		display: block;
		width: 100%;
		margin: 0 0 inherit;
		pointer-events: none;
	}

	.intro {
		font-size: var(--font-size-h3);
		line-height: 1.25;
	}

	.intro-secondary {
		font-size: var(--font-size-h4);
	}

	.lines {
		text-wrap: pretty;
		width: 100%;
		margin-bottom: 5em;
		pointer-events: none;
		@media (max-width: 768px) {
			/* margin-bottom: 2em; */
		}
	}

	strong {
		color: var(--color-primary);
	}
</style>
