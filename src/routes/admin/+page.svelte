<script>
	import { onMount } from 'svelte';
	import Seo from '$lib/components/Seo.svelte';

	onMount(() => {
		window.location.href = '/admin/index.html';
	});
</script>

<!-- The CMS shell. noindex because it is a private admin surface, not a page
     anyone should reach from search. -->
<Seo title="Admin" description="Content management for mikegrunwald.com." noindex />
