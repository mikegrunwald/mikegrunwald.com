<script>
	import AboutIntro from '../lib/components/AboutIntro.svelte';
	import HeroHeader from '../lib/components/HeroHeader.svelte';
	import WorkTeasers from '../lib/components/WorkTeasers.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
</script>

<!-- No title/description props: the homepage IS the site, so it takes the site
     title and description from src/content/meta/site.json verbatim. -->
<Seo />

<section class="page">
	<HeroHeader />
	<AboutIntro />
	<WorkTeasers teasers={data.teasers} />
</section>

<style>
</style>
