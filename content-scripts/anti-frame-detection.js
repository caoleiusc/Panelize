/**
 * Anti-iframe detection script.
 * Injected into the MAIN world to override window.top / window.parent checks
 * that cause some AI sites (e.g. Grok) to crash when running inside an iframe.
 * 
 * Must be injected in "MAIN" world via scripting.executeScript or manifest content_scripts.
 */
(function () {
  try {
    // Override window.top and window.parent to return the current window,
    // so sites that check `window.top !== window` think they are top-level.
    const self = window;

    Object.defineProperty(window, 'top', {
      get: () => self,
      configurable: true
    });

    Object.defineProperty(window, 'parent', {
      get: () => self,
      configurable: true
    });

    Object.defineProperty(window, 'frameElement', {
      get: () => null,
      configurable: true
    });
  } catch (e) {
    // Silently ignore - some browsers may not allow redefining these
    console.warn('[AntiFrameDetection] Could not override window.top:', e);
  }
})();
