
// Single GA click-event helper. `category` groups the click in GA reporting
// (e.g. 'Links', 'Featured Work', 'Floating Menu') so each surface can be
// filtered on its own; `label` identifies the specific item clicked within
// that category. One function rather than one-per-category — the category is
// just data, so a new surface is a new call site, not a new export.
export function trackClick(category, label) {
  window.gtag('event', 'click', {
    event_category: category,
    event_label: label
  });
}
