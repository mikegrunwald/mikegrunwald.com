<script>
	// The ONLY place in the app that writes metadata head tags. Every route
	// renders exactly one of these, which is what keeps title/description/
	// canonical from being emitted twice — Svelte's `<svelte:head>` merges
	// duplicates by tag, not by name, so two components each emitting a
	// `<meta name="description">` would ship both.
	//
	// Values come from src/content/meta/site.json (CMS-editable) with per-page
	// overrides passed in as props. Derivation lives in $lib/seo.js so it can be
	// unit-tested and reused from server loads.
	import siteSettings from '$content/meta/site.json';
	import { page } from '$app/state';
	import { buildSeo } from '$lib/seo.js';

	let {
		title = '',
		description = '',
		image = '',
		type = 'website',
		noindex = false,
		// Defaults to the current route. Passed explicitly only by tests or by a
		// page that needs to canonicalise somewhere other than where it is served.
		path = undefined
	} = $props();

	const seo = $derived(
		buildSeo({
			site: siteSettings,
			title,
			description,
			image,
			type,
			path: path ?? page.url.pathname
		})
	);
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	{#if seo.canonical}
		<link rel="canonical" href={seo.canonical} />
	{/if}
	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}

	<meta property="og:type" content={seo.type} />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	{#if seo.siteName}
		<meta property="og:site_name" content={seo.siteName} />
	{/if}
	{#if seo.canonical}
		<!-- Must agree with rel=canonical above; both come from the same value. -->
		<meta property="og:url" content={seo.canonical} />
	{/if}
	{#if seo.image}
		<meta property="og:image" content={seo.image} />
	{/if}

	<!-- summary_large_image only when there is an image to fill it; a large card
	     with no image renders worse than a plain summary. -->
	<meta name="twitter:card" content={seo.image ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	{#if seo.image}
		<meta name="twitter:image" content={seo.image} />
	{/if}
</svelte:head>
