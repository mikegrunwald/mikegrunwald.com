<script>
	import Tag from '$lib/components/Tag.svelte';
	import AwardLink from '$lib/components/AwardLink.svelte';
	import MediaItem from '$lib/components/MediaItem.svelte';
	import ProjectHeader from '$lib/components/ProjectHeader.svelte';
	import MetaItem from '$lib/components/MetaItem.svelte';

	export let data;
	console.log('data: ', data);
	const content = data.project.meta;

	// get background media; return first available media based on file type - video || image. example in work/patreaon-com.md
	const backgroundMedia = (() => {
		if (!content.media || !content.media[0]) return null;
		return content.media[0];
	})();
</script>

<article class="project">
	<ProjectHeader title={content.title} subtitle={content.subtitle} {backgroundMedia} />
	<div class="content">
		<div class="meta">
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
						{#each content.techList as tech}
							<dd><Tag>{tech}</Tag></dd>
						{/each}
					</MetaItem>
				{/if}

				{#if content.awards && content.awards.length > 0}
					<MetaItem label="Awards" fullWidth awards>
						{#each content.awards as award}
							<dd><AwardLink {award} /></dd>
						{/each}
					</MetaItem>
				{/if}
			</dl>
		</div>

		<div class="description">
			<p>{content.description}</p>
		</div>

		{#if content.media && content.media.length > 0}
			<div class="media-container">
				{#each content.media.slice(1) as media}
					<figure class="media">
						<MediaItem {media} alt={content.title} />
					</figure>
				{/each}
			</div>
		{/if}
	</div>
</article>

<style lang="scss">
	.project {
		overflow: hidden;
		pointer-events: auto;
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
