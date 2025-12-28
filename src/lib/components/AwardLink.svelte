<script>
	import { trackLink } from '$lib/track';
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
	onclick={() => trackLink(award.link.label)}
	target="_blank"
	rel="noopener noreferrer"
	data-cursor="magnetic"
>
	<article class="award">
		<header class="sr-only">
			<h3 class="label">{award.link.label}</h3>
		</header>
		<figure class="logo">
			<!-- <img src={award.logo} alt={award.link.label} /> -->
			<MediaItem media={award.logo} alt={award.link.label} />
		</figure>
		<p class="award-type">{award.awardType}</p>
		<p class="date">{formatDate(award.date)}</p>
	</article>
</a>

<style lang="scss">
	a {
		text-decoration: none;
		display: inline-block;
		pointer-events: auto;
	}

	.award {
		display: flex;
		flex-direction: column;
		// align-items: center;
		gap: var(--spacing-xxs);
	}

	.logo {
		margin: 0;
		height: 60px;

		img {
			height: 100%;
			width: auto;
			display: block;
		}
	}

	.award-type,
	.date {
		margin: 0;
		font-size: var(--font-size-body-xxs);
		// text-align: center;
	}

	.date {
		color: var(--color-text-secondary);
	}
</style>
