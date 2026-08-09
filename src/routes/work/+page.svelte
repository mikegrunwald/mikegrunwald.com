<script>
	import Seo from '$lib/components/Seo.svelte';
	import CaseStudiesSection from '$lib/components/CaseStudiesSection.svelte';
	import ProjectArchive from '$lib/components/ProjectArchive.svelte';

	let { data } = $props();
</script>

<Seo
	title="Case Studies"
	description={`Selected work by Michael Grunwald${
		data.caseStudies.length ? ` — ${data.caseStudies.map((c) => c.title).join(', ')}.` : '.'
	}`}
/>

<div class="page-wrapper">
	<CaseStudiesSection caseStudies={data.caseStudies} />
	<ProjectArchive archive={data.archive} />
</div>

<style>
	.page-wrapper {
		padding: var(--spacing-base);
		pointer-events: all;
		position: relative;
		z-index: 1;
	}
</style>
