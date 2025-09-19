
export function trackLink(label) {
  window.gtag('event', 'click', {
    event_category: 'Links',
    event_label: label
  });
}

