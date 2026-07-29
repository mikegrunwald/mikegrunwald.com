<script>
	import Seo from '$lib/components/Seo.svelte';

	export let data;
</script>

<Seo {...data.seo} />

<article>
	<h1>{data.meta.title}</h1>
	<!-- Trusted content: `html` is marked.parse() of src/content/pages/about.md,
	     authored in this repo via Decap, never user input. Same disable as
	     work/[slug]/+page.svelte uses for project descriptions — rendering the
	     markdown is the whole point of the page. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.html}
</article>
