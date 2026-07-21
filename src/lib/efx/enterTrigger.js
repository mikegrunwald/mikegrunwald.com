// Where a scroll-triggered entrance fires: the element's top must be a quarter
// of a viewport-height into view. Shared so the four entrance effects cannot
// drift apart — they are meant to read as one system, and a page mixing two
// trigger points looks like a bug rather than a choice.
export const ENTER_START = 'top bottom-=25%';
