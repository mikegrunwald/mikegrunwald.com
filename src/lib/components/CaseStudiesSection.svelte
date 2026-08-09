<!-- src/lib/components/CaseStudiesSection.svelte -->
<script>
	let { caseStudies = [] } = $props();
</script>

<section class="case-studies" aria-label="Case Studies">
	<h1 class="h1">Case Studies</h1>
	<p>{caseStudies.length} case studies (grid pending)</p>
</section>
