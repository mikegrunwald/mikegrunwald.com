<script>
	export let data;
	console.log('data', data);
</script>

<article>
	<h1>{data.project.meta.title}</h1>
	{@html data.project.html}
</article>
