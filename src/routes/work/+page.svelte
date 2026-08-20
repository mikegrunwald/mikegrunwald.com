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
		/* No z-index (was 1): it made this a stacking context, which trapped the
		   global magnetic cursor dot outside it — the dot could then only paint
		   above or below ALL page content, never behind a case-study button but
		   over its video. Without it, the card content shares the root stacking
		   context with the dot, so the dot can sandwich between the two. Content
		   still sits above the fixed background canvas via DOM order (position:
		   relative keeps it painting after the earlier-in-DOM canvas). */

		@media (max-width: 767px) {
			padding: var(--spacing-base) var(--spacing-sm);
		}
	}
</style>
