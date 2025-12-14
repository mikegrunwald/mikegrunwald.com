<script>
	export let data;
</script>

<h1>Projects</h1>

{#each data.work as item}
	<article>
		<h2>{item.meta.title}</h2>
		{#if item.meta.thumbnail}
			<img src={item.meta.thumbnail} alt="" />
		{/if}
		<p>{item.meta.summary}</p>
		<a href={`/work/${item.slug}`}>View project</a>
	</article>
{/each}
