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
            // Strategy 1: Use data-message-author-role attribute
            const assistantMsgs = document.querySelectorAll('[data-message-author-role="assistant"]');
            if (assistantMsgs.length > 0) {
              const lastMsg = assistantMsgs[assistantMsgs.length - 1];
              const textContainer = lastMsg.querySelector('.font-claude-message') || lastMsg;
              const text = (textContainer.innerText || '').trim();
              if (text.length > 0) {
                targetElement = textContainer;
                break;
              }
            }

            // Strategy 2: data-testid based selectors (recent Claude UI)
            const testIdMsgs = document.querySelectorAll('[data-testid*="assistant"], [data-testid*="chat-message"]');
            if (testIdMsgs.length > 0) {
              for (let i = testIdMsgs.length - 1; i >= 0; i--) {
                const candidate = testIdMsgs[i];
                if (candidate && candidate.innerText && candidate.innerText.trim().length > 0) {
                  targetElement = candidate;
                  break;
                }
              }
              if (targetElement) break;
            }

            // Strategy 3: Broad fallback selectors for various Claude layouts
            const claudeFallbackSelectors = [
              '.font-claude-message',
              '[data-testid="assistant-message"]',
              '.claude-message',
              '[data-is-streaming="false"] .prose',
              '.prose:not([contenteditable])',
              '[class*="assistant"] .prose',
              '[class*="message-content"]',
              '[class*="response"] .prose',
              'article .prose'
            ];
            for (const sel of claudeFallbackSelectors) {
              try {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                  for (let i = els.length - 1; i >= 0; i--) {
                    const candidate = els[i];
                    if (candidate && candidate.innerText && candidate.innerText.trim().length > 0) {
                      targetElement = candidate;
                      break;
                    }
                  }
                  if (targetElement) break;
                }
              } catch(e) { /* ignore invalid selector */ }
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

      // ===== Nuclear fallback for ALL providers =====
      // If no provider-specific selector matched, scan the page for
      // non-editable containers with rendered markdown content (p, li, code, pre, etc.)
      // This handles DOM structure changes and unknown/new providers.
      try {
        const candidates = [];
        document.querySelectorAll('div, article, section').forEach(el => {
          // Must not be or inside an editable input area
          if (el.isContentEditable || el.closest('[contenteditable="true"]')) return;
          // Must not CONTAIN the input area (skip wrapper containers)
          if (el.querySelector('[contenteditable="true"]')) return;
          // Skip nav/header/footer/aside elements
          if (el.closest('nav, header, footer, aside')) return;
          // Must contain rendered formatted content (rendered markdown)
          if (!el.querySelector('p, li, pre, code, h1, h2, h3, h4, h5, h6, table, blockquote, ol, ul')) return;
          // Must have substantial text
          const text = (el.innerText || '').trim();
          if (text.length < 30) return;
          candidates.push({ el, text });
        });

        if (candidates.length > 0) {
          // Return the last candidate (most recent response)
          return candidates[candidates.length - 1].text;
        }
      } catch (fallbackErr) {
        console.error('[ExtractOutput] Fallback error:', fallbackErr);
      }

    } catch (e) {
      console.error('[ExtractOutput] Error extracting text:', e);
    }
    return '';
  }

  // Listen for window postMessage from the multi-panel iframe wrapper
  window.addEventListener('message', function(event) {
    // Only accept messages from our extension's multi-panel context
    if (event.data && event.data.type === 'EXTRACT_LATEST_OUTPUT' && event.data.context === 'multi-panel') {
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
