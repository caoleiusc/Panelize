/**
 * Anti-iframe detection script.
 * Injected into the MAIN world to override window.top / window.parent checks
 * that cause some AI sites (e.g. Grok) to crash when running inside an iframe.
 * 
 * Must be injected in "MAIN" world via scripting.executeScript or manifest content_scripts.
 */
(function () {
  if (window.name !== 'panelize-iframe') return;

  try {
    // Override window.top and window.parent to return the current window,
    // so sites that check `window.top !== window` think they are top-level.
    const self = window;

    // Modern browsers protect window.top/parent on the instance, 
    // but we can often override the getter on Window.prototype.
    const overridePrototype = (prop) => {
      try {
        const desc = Object.getOwnPropertyDescriptor(Window.prototype, prop);
        if (desc && desc.configurable) {
          Object.defineProperty(Window.prototype, prop, {
            get: () => window,
            configurable: true
          });
        } else {
          // Fallback to define on instance if not on prototype (older browsers)
          Object.defineProperty(window, prop, {
            get: () => window,
            configurable: true
          });
        }
      } catch (e) {
        console.warn(`[AntiFrameDetection] Could not override ${prop}:`, e);
      }
    };

    overridePrototype('top');
    overridePrototype('parent');
    
    // frameElement is usually on the instance
    try {
      Object.defineProperty(window, 'frameElement', {
        get: () => null,
        configurable: true
      });
    } catch(e) {}
    
    // Chromium specific frame detection bypass
    try {
      if (window.location.ancestorOrigins) {
        Object.defineProperty(window.location, 'ancestorOrigins', {
          get: () => ({
            length: 0,
            item: () => null,
            contains: () => false
          }),
          configurable: true
        });
      }
    } catch(e) {}
    
    
    // Some sites check if window.self !== window.top
    // This is hard to spoof perfectly, but we can try to override toString or similar indicators if they use them.
  } catch (e) {
    // Silently ignore - some browsers may not allow redefining these
    console.warn('[AntiFrameDetection] Could not override window.top:', e);
  }
})();
