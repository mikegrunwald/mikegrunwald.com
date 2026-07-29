<script>
	import Seo from '$lib/components/Seo.svelte';

	export let data;
</script>

<!-- Title matches the h1 below. The description names the clients rather than
     describing the page generically, so the search result says something. -->
<Seo
	title="Case Studies"
	description={`Selected work by Michael Grunwald${
		data.work.length ? ` — ${data.work.map((item) => item.meta.title).join(', ')}.` : '.'
	}`}
/>

<div class="page-wrapper">
	<header class="page-header">
		<h1 class="h1">Case Studies</h1>
	</header>

	<!-- Keyed on slug: it is the filename of the source markdown, so it is unique
	     across the collection and stable across reorders (`order` is not). -->
	{#each data.work as item (item.slug)}
		<article class="work-item">
			<a class="button outline small" data-cursor="magnetic" href={`/work/${item.slug}`}
				>{item.meta.title}</a
			>
		</article>
	{/each}
</div>

<style>
	.page-wrapper {
		padding: var(--spacing-base);
		pointer-events: all;
		position: relative;
		z-index: 1;
	}

	.page-header {
		margin-bottom: var(--spacing-base);
	}
	.work-item {
		margin-bottom: var(--spacing-xs);
	}

	.link {
		text-decoration: none;
	}
</style>
