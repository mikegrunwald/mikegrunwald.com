<script>
	import { trackClick } from '$lib/track';
	import MediaItem from './MediaItem.svelte';

	let { award } = $props();

	// Format ISO date to readable format (e.g., "Nov 24, 2024")
	function formatDate(isoDate) {
		return new Date(isoDate).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<a
	href={award.link.url}
	onclick={() => trackClick('Links', award.link.label)}
	target="_blank"
	rel="noopener noreferrer"
>
	<article class="award">
		<header class="sr-only">
			<h3 class="label">{award.link.label}</h3>
		</header>
		<figure class="logo">
			<MediaItem class="logo-container" media={award.logo} alt={award.link.label} />
		</figure>
		<p class="award-type">{award.awardType}</p>
		<p class="date">{formatDate(award.date)}</p>
	</article>
</a>

<style lang="scss">
	a {
		display: inline-block;
		text-decoration: none;
		pointer-events: auto;
		padding: calc(var(--spacing-xxs) / 2);
		border-radius: var(--border-radius);

		&:hover {
			.logo {
				color: var(--color-primary-light);
			}
		}

		&:focus-visible {
			outline: var(--focus-outline);
			outline-offset: var(--focus-outline-offset);
		}
	}

	.award {
		display: flex;
		align-items: center;
		gap: var(--spacing-xxs);
	}

	.logo {
		--media-height: 40px;
		--media-width: auto;

		color: var(--color-white);
		display: block;
		filter: drop-shadow(
			0px 0px var(--award-glow, 14px) color-mix(in srgb, currentColor 67%, transparent)
		);
		margin: 0;
		line-height: 0;
	}

	.award-type {
		font-weight: bold;
	}

	.award-type,
	.date {
		margin: 0;
		font-family: var(--font-family-mono);
		font-size: 0.375em;
		letter-spacing: 0.01em;
		margin-bottom: 0;
	}

	.date {
		color: var(--color-text-secondary);
	}
</style>
