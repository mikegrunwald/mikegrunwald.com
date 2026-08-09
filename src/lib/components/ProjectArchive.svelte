<!-- src/lib/components/ProjectArchive.svelte -->
<script>
	let { archive = [] } = $props();
</script>

<section class="project-archive" aria-label="Project Archive">
	<h2 class="h1">Project Archive</h2>
	<p>{archive.length} projects (table pending)</p>
</section>
