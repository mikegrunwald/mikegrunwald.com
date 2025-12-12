<script>
	export let data;
</script>

<h1>Projects</h1>

{#each data.projects as project}
	<article>
		<h2>{project.meta.title}</h2>
		{#if project.meta.thumbnail}
			<img src={project.meta.thumbnail} alt="" />
		{/if}
		<p>{project.meta.summary}</p>
		<a href={`/projects/${project.slug}`}>View project</a>
	</article>
{/each}
