<script>
  import AboutIntro from '../lib/components/AboutIntro.svelte';
  import HeroHeader from '../lib/components/HeroHeader.svelte';
  import UserActions from '../lib/components/UserActions.svelte';
</script>

<svelte:head>
  <title>Michael Grunwald | Creative Frontend Developer</title>
  <meta
    name="description"
    content="Personal website of Michael Grunwald—a seasoned creative UI/UX designer and developer who specializes in breathing life into complex user experiences."
  />
</svelte:head>

<section>
  <HeroHeader />
  <AboutIntro />
  <UserActions />
</section>

<style>
</style>
