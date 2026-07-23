<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { tilt } from '$lib/actions/tilt';
	import AwardLink from '$lib/components/AwardLink.svelte';
	import MediaItem from '$lib/components/MediaItem.svelte';
	import MetaItem from '$lib/components/MetaItem.svelte';
	import ProjectHeader from '$lib/components/ProjectHeader.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import { BlurScrollEffect } from '$lib/efx/blurScrollEffect.js';
	import { GlowEnterEffect } from '$lib/efx/glowEnterEffect.js';
	import { ScrambleEnterEffect } from '$lib/efx/scrambleEnterEffect.js';
	import { StaggerEnterEffect } from '$lib/efx/staggerEnterEffect.js';

	const itemTiltOptions = { maxTilt: 8.2, perspective: 670, ease: 0.067 };

	let { data } = $props();

	// Use $derived to make content reactive to data changes
	const content = $derived(data.project.meta);

	// get background media; return first available media based on file type - video || image. example in work/patreaon-com.md
	const backgroundMedia = $derived.by(() => {
		if (!content.media || !content.media[0]) return null;
		return content.media[0];
	});

	let metaEl;
	let descriptionEl;
	// One array for every effect on the page. These pages are reached by
	// client-side navigation from the carousel, so anything not destroyed here
	// survives the round trip holding scroll positions measured against a
	// document that no longer exists.
	let effects = [];
	// Guards against unmounting during the tick() await below: without it,
	// onDestroy would run first against an empty effects array, then the
	// resumed microtask would query a torn-down metaEl and build effects that
	// never make it into the teardown array.
	let live = true;

	onMount(async () => {
		// The h3s arrive through {@html descriptionHtml}, so they are not in the
		// DOM until Svelte has flushed. Same reason AboutIntro awaits a tick.
		await tick();
		if (!live) return;

		// Non-full-width values scramble. The `.scramble-target` span is the
		// aria-hidden copy — never the visually-hidden one, which must keep its
		// real text for screen readers.
		metaEl
			.querySelectorAll('.meta-item:not(.full-width) .scramble-target')
			.forEach((el) => effects.push(new ScrambleEnterEffect(el)));

		// Full-width groups (Tech, Awards) enter together, one group per row so
		// each keeps its own stagger rather than sharing one across the page.
		// Every full-width group gets the rise-and-fade stagger; Awards
		// additionally get GlowEnterEffect for their logo glow. Both effects
		// share duration, ease, stagger and ScrollTrigger start, so the two
		// stay visually in sync on the awards row.
		metaEl.querySelectorAll('.meta-item.full-width').forEach((group) => {
			effects.push(new StaggerEnterEffect(group.querySelectorAll('dd')));
		});

		metaEl.querySelectorAll('.meta-item.full-width.awards').forEach((group) => {
			effects.push(new GlowEnterEffect(group.querySelectorAll('dd')));
		});

		// Faster than the enter-mode default: these are body subheads, several of
		// them down the page, so the title's more deliberate pacing reads as sluggish
		// by the time you have scrolled past the third one.
		descriptionEl
			.querySelectorAll('h3')
			.forEach((h3) =>
				effects.push(new BlurScrollEffect(h3, { mode: 'enter', duration: 0.3, staggerAmount: 0.5 }))
			);
	});

	onDestroy(() => {
		live = false;
		for (const effect of effects) effect.destroy();
		effects = [];
	});
</script>

<article class="project">
	<ProjectHeader
		title={content.title}
		subtitle={content.subtitle}
		{backgroundMedia}
		slug={data.slug}
	/>
	<div class="content">
		<div class="meta" bind:this={metaEl}>
			<dl>
				{#if content.agency}
					<MetaItem label="Agency" value={content.agency} />
				{/if}

				{#if content.partners && content.partners.length > 0}
					<MetaItem
						label={`Partner${content.partners.length > 1 ? 's' : ''}`}
						values={content.partners}
					/>
				{/if}

				{#if content.client}
					<MetaItem label="Client" value={content.client} />
				{/if}

				{#if content.role}
					<MetaItem label="Role" value={content.role} />
				{/if}

				{#if content.year}
					<MetaItem label="Year" value={content.year} />
				{/if}

				{#if content.techList}
					<MetaItem label="Tech" fullWidth>
						{#each content.techList as tech (tech)}
							<dd><Tag>{tech}</Tag></dd>
						{/each}
					</MetaItem>
				{/if}

				{#if content.awards && content.awards.length > 0}
					<MetaItem label="Awards" fullWidth awards>
						{#each content.awards as award (award.url || award.label || award)}
							<dd><AwardLink {award} /></dd>
						{/each}
					</MetaItem>
				{/if}
			</dl>
		</div>

		<div class="description bullets" bind:this={descriptionEl}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html content.descriptionHtml || content.description}
		</div>

		{#if content.media && content.media.length > 0}
			<div class="media-container">
				{#each content.media.slice(1) as media (media.src || media.url || media.alt || JSON.stringify(media))}
					<figure class="media">
						<MediaItem {media} alt={content.title} />
					</figure>
				{/each}
			</div>
		{/if}

		{#if content.links && content.links.length > 0}
			<section class="project-links">
				<ul class="link-list">
					{#each content.links as link (link.url || link.label || JSON.stringify(link))}
						<li>
							<a
								use:tilt={itemTiltOptions}
								data-cursor="magnetic"
								class="button outline"
								href={link.url}
								target="_blank"
								rel="noopener noreferrer">{link.label}</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Re-enabling this needs the entrance effects re-keyed on data.slug first:
          SvelteKit reuses this component across /work/a -> /work/b, so onMount and
          onDestroy do not re-run. Project A's effects would survive with stale
          positions, project B would get no entrance, and the scramble originals
          cached on the reused spans would resolve B's values to A's text. -->
		<!-- <NextProjectLink nextProject={data.nextProject} /> -->
	</div>
</article>

<style lang="scss">
	.project {
		overflow: hidden;
		pointer-events: auto;
	}

	.content {
		padding: var(--spacing-base);

		@media (max-width: 1023px) {
			padding: var(--spacing-sm) var(--spacing-xs);
		}
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

	.description {
		font-size: var(--font-size-h4);
		margin-bottom: var(--spacing-base);
		line-height: var(--line-height-text);
		max-width: 64ch;
	}

	.media {
		--media-width: 100%;
		--media-height: auto;

		border: var(--border);
		border-radius: var(--border-radius);
		box-shadow:
			0 0 16px 0 #33c5f3,
			inset 0 0 12px #33c5f3;
		overflow: hidden;
		margin-bottom: var(--spacing-sm);
		position: relative;
		z-index: 1;
	}

	.project-links {
		text-align: center;
		padding-block: var(--spacing-base);
	}

	.link-list {
		display: flex;
		align-items: center;
		justify-content: space-around;
		gap: var(--spacing-xs);

		@media (max-width: 1280px) {
			flex-direction: column;
			min-height: auto;
			gap: var(--spacing-sm);
			padding-top: var(--spacing-sm);
		}

		@media (max-width: 768px) {
			justify-content: center;
			padding: var(--spacing-sm);
		}
	}
</style>
