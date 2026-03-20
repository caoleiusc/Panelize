/**
 * Content script to extract the latest AI response text from the page.
 */
(function() {
  'use strict';

  // Detect which provider we're on based on hostname
  function detectProvider() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
      return 'chatgpt';
    } else if (hostname.includes('claude.ai')) {
      return 'claude';
    } else if (hostname.includes('gemini.google.com')) {
      return 'gemini';
    } else if (hostname.includes('grok.com') || hostname.includes('x.com')) {
      return 'grok';
    } else if (hostname.includes('deepseek.com')) {
      return 'deepseek';
    } else if (hostname.includes('kimi.com')) {
      return 'kimi';
    } else if (hostname.includes('google.com')) {
      return 'google';
    }
    return null;
  }

  function getLatestResponseText(provider) {
    try {
      let elements = [];
      let targetElement = null;

      switch(provider) {
        case 'chatgpt':
          elements = document.querySelectorAll('div[data-message-author-role="assistant"] .markdown');
          targetElement = elements[elements.length - 1];
          break;
        case 'claude':
          {
            // Try selectors in order of reliability (most specific first)
            const claudeSelectors = [
              '[data-testid="assistant-message"]',
              '.font-claude-message',
              '.claude-message',
              '[data-is-streaming="false"] .prose',
              '.prose:not([contenteditable])',
              '[class*="assistant"] .prose',
              '[class*="message-content"]'
            ];
            for (const sel of claudeSelectors) {
              const els = document.querySelectorAll(sel);
              if (els.length > 0) {
                const candidate = els[els.length - 1];
                if (candidate && candidate.innerText && candidate.innerText.trim()) {
                  targetElement = candidate;
                  break;
                }
              }
            }
          }
          break;
        case 'gemini':
          elements = document.querySelectorAll('message-content .markdown, .model-response-text, message-content');
          targetElement = elements[elements.length - 1];
          break;
        case 'grok':
          {
            const proseEls = document.querySelectorAll('.prose:not([contenteditable="true"])');
            targetElement = proseEls[proseEls.length - 1];
            if (!targetElement || !targetElement.innerText.trim()) {
              const msgRows = document.querySelectorAll('div[class*="message-bubble"]');
              targetElement = msgRows[msgRows.length - 1];
            }
          }
          break;
        case 'deepseek':
          elements = document.querySelectorAll('.ds-markdown--block, div[class*="ds-markdown"]');
          targetElement = elements[elements.length - 1];
          break;
        default:
          elements = document.querySelectorAll('.markdown, .prose, article:last-of-type, .message:last-of-type');
          targetElement = elements[elements.length - 1];
      }

      if (targetElement) {
        return (targetElement.innerText || targetElement.textContent || '').trim();
      }
    } catch (e) {
      console.error('[ExtractOutput] Error extracting text:', e);
    }
    return '';
  }

  // Listen for window postMessage from the multi-panel iframe wrapper
  window.addEventListener('message', function(event) {
    // Only accept messages from our extension's multi-panel context
    if (event.data && event.data.type === 'EXTRACT_LATEST_OUTPUT') {
      const provider = detectProvider();
      const text = getLatestResponseText(provider);
      
      // Post back to parent using the MessagePort if provided
      if (event.ports && event.ports.length > 0) {
        event.ports[0].postMessage({ success: true, text: text });
      } else {
        // Fallback to source postMessage
        event.source.postMessage({
          type: 'EXTRACT_LATEST_OUTPUT_RESULT',
          success: true,
          text: text
        }, event.origin);
      }
    }
  });

})();
