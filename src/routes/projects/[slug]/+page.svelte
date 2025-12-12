<script>
	export let data;
</script>

<article>
	<h1>{data.project.meta.title}</h1>
	{@html data.project.html}
</article>
