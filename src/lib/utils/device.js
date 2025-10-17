import Bowser from "bowser";
import { browser as isBrowser } from '$app/environment';

let browserParser;

function getBrowserParser() {
  if (!isBrowser) return null;
  if (!browserParser) {
    browserParser = Bowser.getParser(window.navigator.userAgent);
  }
  return browserParser;
}

export const isMobile = () => {
  const parser = getBrowserParser();
  return parser ? parser.getPlatformType() === 'mobile' : false;
};

export const isTablet = () => {
  const parser = getBrowserParser();
  return parser ? parser.getPlatformType() === 'tablet' : false;
};

export const isDesktop = () => {
  const parser = getBrowserParser();
  return parser ? parser.getPlatformType() === 'desktop' : false;
};

export const isTouchCapable = () => {
  if (!isBrowser) return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};
