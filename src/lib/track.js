
export function trackLink(label) {
  window.gtag('event', 'click', {
    event_category: 'Links',
    event_label: label
  });
}

// Featured-work carousel click-through. Kept separate from trackLink so these
// land in their own 'Featured Work' category (not the generic 'Links' bucket),
// with the project title as the label — so GA reports a clean per-project
// breakdown of which teasers get clicked.
export function trackFeaturedWorkClick(project) {
  window.gtag('event', 'click', {
    event_category: 'Featured Work',
    event_label: project
  });
}

