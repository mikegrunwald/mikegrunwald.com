<script>
	import AboutIntro from '../lib/components/AboutIntro.svelte';
	import HeroHeader from '../lib/components/HeroHeader.svelte';
	import WorkTeasers from '../lib/components/WorkTeasers.svelte';
	import siteSettings from '$content/meta/site.json';

	let { data } = $props();
</script>

<svelte:head>
	<!-- <title>Michael Grunwald | Creative Frontend Developer</title> -->
	<title>{siteSettings.title}</title>
	<meta name="description" content={siteSettings.description} />
</svelte:head>

<section class="page">
	<HeroHeader />
	<AboutIntro />
	<WorkTeasers teasers={data.teasers} />
</section>

<style>
</style>
