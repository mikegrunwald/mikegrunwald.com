<script>
	import AboutIntro from '../lib/components/AboutIntro.svelte';
	import HeroHeader from '../lib/components/HeroHeader.svelte';
	import UserActions from '../lib/components/UserActions.svelte';
	import siteSettings from '$content/meta/site.json';
</script>

<svelte:head>
	<!-- <title>Michael Grunwald | Creative Frontend Developer</title> -->
	<title>{siteSettings.title}</title>
	<meta name="description" content={siteSettings.description} />
</svelte:head>

<section class="page">
	<HeroHeader />
	<AboutIntro />
	<!-- TODO: ADD WORK TEASERS HERE -->
	<UserActions />
</section>

<style>
</style>
