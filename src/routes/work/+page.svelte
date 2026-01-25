<script>
	export let data;
</script>

<div class="page-wrapper">
	<header class="page-header">
		<h1 class="h1">Case Studies</h1>
	</header>

	{#each data.work as item}
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
