// Single GA click-event helper. `name` is the GA4 event name and must be
// specific to the action (e.g. 'resume_click'): GA can only mark whole event
// names as key events, and the generic 'click' name is already used by
// Enhanced measurement's outbound clicks. `category` groups the click by
// surface (e.g. 'Links', 'Floating Menu') and `label` identifies the item —
// both are registered custom dimensions, so they show in User Explorer.
export function trackClick(name, category, label) {
	if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
	window.gtag('event', name, {
		event_category: category,
		event_label: label
	});
}

// Sends one GA4 page_view for the route currently on screen. This is the ONLY
// source of page views: app.html configures gtag with `send_page_view: false`,
// because gtag's automatic view fires on document load only and would miss
// every client-side navigation in this SPA.
//
// Location and title are passed explicitly rather than left to gtag's own
// defaults. gtag reads document.title at send time, and on a client-side
// navigation the head is written by Seo.svelte's <svelte:head> — passing the
// values we mean makes the event independent of when that flush lands.
//
// `gtag` is guarded rather than assumed: the stub in app.html is defined
// synchronously so calls before the async script loads simply queue on
// dataLayer, but an ad blocker can remove the whole thing, and a tracking
// failure must never break navigation.
export function trackPageView() {
	if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
	window.gtag('event', 'page_view', {
		page_location: window.location.href,
		page_path: window.location.pathname + window.location.search,
		page_title: document.title
	});
}
