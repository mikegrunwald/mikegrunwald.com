<script>
	import { trackLink } from '$lib/track';
	import { tilt } from '$lib/actions/tilt';

	let { nextProject } = $props();

	const tiltOptions = { maxTilt: 8.2, perspective: 670, ease: 0.067 };
</script>

<aside class="next-project-link">
	<p class="link-label">Next Project</p>
	<a
		class="link"
		href="/work/{nextProject.slug}"
		use:tilt={tiltOptions}
		data-cursor="magnetic"
		onclick={() => trackLink(`Next Project: ${nextProject.meta.title}`)}
	>
		{nextProject.meta.title}
	</a>
</aside>

<style lang="scss">
	.next-project-link {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-xs);
		padding: var(--spacing-base);
		padding-top: var(--spacing-xl);
	}

	.link-label {
		font-size: var(--font-size-small);
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}

	.link {
		font-family: var(--font-family-heading);
		font-size: var(--font-size-h2);
		color: var(--color-text-primary);
		text-decoration: none;
		transition: color var(--animation-duration) var(--animation-timing);
		position: relative;
		display: inline-block;

		&:hover {
			color: var(--color-primary-light);
		}

		&::after {
			content: '→';
			margin-left: var(--spacing-xs);
			display: inline-block;
			transition: transform var(--animation-duration) var(--animation-timing);
		}

		&:hover::after {
			transform: translateX(0.5rem);
		}
	}

	@media (max-width: 768px) {
		.next-project-link {
			padding: var(--spacing-sm);
			padding-top: var(--spacing-base);
		}

		.link {
			font-size: var(--font-size-h3);
		}
	}
</style>
