<script>
	import Tag from '$lib/components/Tag.svelte';
	import AwardLink from '$lib/components/AwardLink.svelte';
	import { getMediaInfo } from '$lib/utils/media-utils';

	export let data;
	console.log('data: ', data);
	const content = data.project.meta;

	// get background media; return first available media based on file type - video || image. example in work/patreaon-com.md
	const backgroundMedia = (() => {
		if (!content.media || !content.media[0]) return null;
		return getMediaInfo(content.media[0]);
	})();
</script>

<article class="project">
	<header class="project-header">
		<figure class="background-media">
			{#if backgroundMedia}
				{#if backgroundMedia.type === 'video'}
					<video src={backgroundMedia.src} autoplay muted loop playsinline></video>
				{:else if backgroundMedia.type === 'image'}
					<img src={backgroundMedia.src} alt={content.title} />
				{/if}
			{/if}
		</figure>
		<h1 class="title super">{content.title}</h1>
		<h2 class="subtitle display">{content.subtitle}</h2>
	</header>
	<div class="content">
		<div class="meta">
			<dl>
				{#if content.agency}
					<div class="meta-item">
						<dt class="h4">Agency</dt>
						<dd>{content.agency}</dd>
					</div>
				{/if}

				{#if content.partners.length > 0}
					<div class="meta-item">
						<dt class="h4">{`Partner${content.partners.length > 1 ? 's' : ''}`}</dt>
						{#each content.partners as partner}
							<dd>{partner}</dd>
						{/each}
					</div>
				{/if}

				{#if content.client}
					<div class="meta-item">
						<dt class="h4">Client</dt>
						<dd>{content.client}</dd>
					</div>
				{/if}

				{#if content.role}
					<div class="meta-item">
						<dt class="h4">Role</dt>
						<dd>{content.role}</dd>
					</div>
				{/if}

				{#if content.year}
					<div class="meta-item">
						<dt class="h4">Year</dt>
						<dd>{content.year}</dd>
					</div>
				{/if}

				{#if content.techList}
					<div class="meta-item full-width">
						<dt class="h4">Tech</dt>
						{#each content.techList as tech}
							<dd><Tag>{tech}</Tag></dd>
						{/each}
					</div>
				{/if}

				{#if content.awards && content.awards.length > 0}
					<div class="meta-item full-width awards">
						<dt class="h4">Awards</dt>
						{#each content.awards as award}
							<dd><AwardLink {award} /></dd>
						{/each}
					</div>
				{/if}
			</dl>
		</div>

		<div class="description">
			<p>{content.description}</p>
		</div>

		{#if content.media.length > 0}
			<div class="media-container">
				{#each content.media.slice(1) as media}
					<figure class="media">
						{#if getMediaInfo(media).type === 'video'}
							<video src={getMediaInfo(media).src} autoplay muted loop playsinline></video>
						{:else if getMediaInfo(media).type === 'image'}
							<img src={getMediaInfo(media).src} alt={content.title} />
						{/if}
					</figure>
				{/each}
			</div>
		{/if}
	</div>
	{@html data.project.html}
</article>

<style lang="scss">
	.project {
		overflow: hidden;
		pointer-events: auto;
	}

	.project-header {
		position: relative;
		width: 100dvw;
		height: 100dvh;
	}

	.background-media {
		position: relative;
		z-index: -1;
		&:before {
			background-image:
				url('/images/noise.webp'), url('/images/noise.webp'), url('/images/noise.webp'),
				url('/images/noise.webp');
			background-size: 200px 200px;
			background-position: center center;
			background-repeat: repeat;
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 1;
		}

		&:after {
			background: linear-gradient(
				in oklch to bottom,
				rgba(0, 0, 0, 0.95) 0%,
				rgba(0, 0, 0, 0.666) 50%,
				rgba(0, 0, 0, 0.95) 100%
			);
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 2;
		}

		> video,
		> img {
			min-width: 100dvw; /* Ensures it covers the full width */
			min-height: 100dvh; /* Ensures it covers the full height */
			width: auto;
			height: auto;
			object-fit: cover;
		}
	}

	.title {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 3;
	}

	.subtitle {
		position: absolute;
		bottom: 0;
		z-index: 4;
		line-height: 0.9;
		margin-bottom: 0;
	}

	@supports (-webkit-text-stroke: 3px black) {
		.title,
		.subtitle {
			-webkit-text-fill-color: transparent;
			-webkit-text-stroke: 1px var(--color-primary);
		}
	}
	.content {
		padding: var(--spacing-base);
	}

	.meta {
		margin-bottom: var(--spacing-base);
	}

	dl {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	dt {
		margin-bottom: var(--spacing-xxs);
		color: var(--color-primary);
	}

	dd {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-body-xxs);
		letter-spacing: 0.01em;
		line-height: var(--line-height-text);
		margin-left: 0.75em;
		display: block;
	}

	.meta-item {
		&.full-width {
			width: 100%;
			display: flex;
			align-items: end;
			flex-wrap: wrap;
			gap: 2px 4px;

			dt {
				margin-bottom: 0;
			}
			dd {
				display: inline;
				&:not(:first-of-type) {
					margin-left: 0;
				}
			}
		}

		&.awards {
			gap: var(--spacing-xs);
		}
	}

	.description {
		margin-bottom: var(--spacing-base);
		line-height: var(--line-height-text);
	}

	.media {
		border: var(--border);
		border-radius: var(--border-radius);
		box-shadow:
			0 0 16px 0 #33c5f3,
			inset 0 0 12px #33c5f3;
		overflow: hidden;
		margin-bottom: var(--spacing-sm);
	}
</style>
