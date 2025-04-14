// AI Content Guardian - Content Script
// Analyzes and modifies webpage content in real-time

// Global state
let extensionSettings = {
  enabled: true,
  autoRephrase: true,
  showWarnings: true,
  sensitivityLevel: 'medium'
};

// Element observer - watches for content changes
let observer = null;

// Cache of analyzed text to avoid duplicate processing
const analyzedTextCache = new Map();

// Elements to ignore (not to scan)
const IGNORE_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS', 'INPUT', 'TEXTAREA'];
const IGNORE_CLASS_PATTERNS = [
  /ai-guardian-/,
  /code/i,
  /syntax/i,
  /pre/i
];

// Initialize the extension
function initializeExtension() {
  // Fetch settings from storage
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    if (response && response.settings) {
      extensionSettings = response.settings;
      
      if (extensionSettings.enabled) {
        // Start content analysis
        setupObserver();
        analyzePageContent();
      }
    }
  });

  // Listen for messages
  chrome.runtime.onMessage.addListener((message) => {
    // Handle setting changes
    if (message.type === 'SETTINGS_UPDATED') {
      extensionSettings = message.settings;
      
      if (extensionSettings.enabled) {
        if (!observer) {
          setupObserver();
        }
        analyzePageContent();
      } else {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        // Remove all modifications
        removeAllModifications();
      }
    }
    
    // Handle page navigation or URL changes
    if (message.type === 'PAGE_CHANGED') {
      console.log('Page changed, re-analyzing content');
      
      // Clear cache to ensure fresh analysis
      analyzedTextCache.clear();
      
      // Remove previous modifications
      removeAllModifications();
      
      // Reset all previously processed elements
      document.querySelectorAll('[data-ai-guardian-processed]').forEach(el => {
        el.removeAttribute('data-ai-guardian-processed');
      });
      
      // Start new analysis if enabled
      if (extensionSettings.enabled) {
        // Small delay to let page finish rendering
        setTimeout(() => {
          analyzePageContent();
        }, 300);
      }
    }
  });
}

// Set up mutation observer to detect DOM changes
function setupObserver() {
  // Use a more efficient debounced approach for DOM mutations
  let pendingMutations = [];
  let processingTimeout = null;
  
  // Process mutations in batches for better performance
  function processMutations() {
    // Extract unique elements from mutations to avoid duplicate processing
    const elementsToProcess = new Set();
    
    pendingMutations.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        elementsToProcess.add(node);
        
        // Also add text-containing children for processing
        const textElements = node.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
        textElements.forEach(el => elementsToProcess.add(el));
      }
    });
    
    // Process each unique element
    elementsToProcess.forEach(analyzeElement);
    
    // Clear pending mutations
    pendingMutations = [];
    processingTimeout = null;
  }
  
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // For each added node, add to pending mutations
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            pendingMutations.push(node);
          }
        });
      }
    });
    
    // Debounce processing to avoid excessive CPU usage
    if (!processingTimeout) {
      processingTimeout = setTimeout(processMutations, 300);
    }
  });
  
  // Start observing the document with optimized settings
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false // Don't need character data changes
  });
}

// Analyze all page content on load
function analyzePageContent() {
  // Track start time for performance monitoring
  const startTime = performance.now();
  console.log("AI Content Guardian: Starting content analysis");
  
  // Get the main content area of the page
  // Most sites have main content in specific elements like main, article, or content divs
  const mainContentSelectors = [
    'main', 'article', '.content', '#content', '.main-content', '#main-content',
    '[role="main"]', '.post', '.story', '.entry', '.page-content', '.article-content'
  ];
  
  let contentContainers = [];
  
  // Try to find content containers
  for (const selector of mainContentSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      contentContainers = Array.from(elements);
      break;
    }
  }
  
  // If no specific content containers found, use the body
  if (contentContainers.length === 0) {
    contentContainers = [document.body];
  }
  
  // High-priority text elements within content containers
  const textElementSelectors = 'p, h1, h2, h3, h4, h5, h6, li, .text, [role="text"]';
  let priorityElements = [];
  
  // Find text elements inside our content containers
  contentContainers.forEach(container => {
    const elements = container.querySelectorAll(textElementSelectors);
    if (elements.length > 0) {
      // Pre-filter to avoid empty or small elements
      Array.from(elements).forEach(el => {
        if (!shouldIgnoreElement(el) && 
            el.innerText && 
            el.innerText.trim().length > 15) {
          priorityElements.push(el);
        }
      });
    }
  });
  
  console.log(`AI Content Guardian: Found ${priorityElements.length} high-priority elements to analyze`);
  
  // Use a more efficient batch processing approach
  const batchSize = 5; // Smaller batches for faster response
  const elementBatches = [];
  
  // Create batches of elements
  for (let i = 0; i < priorityElements.length; i += batchSize) {
    elementBatches.push(priorityElements.slice(i, i + batchSize));
  }
  
  // Process batches with delays to avoid freezing the UI
  console.log(`AI Content Guardian: Processing ${elementBatches.length} batches`);
  processBatches(elementBatches, 0);
  
  // Only search for secondary elements if we find fewer than 10 primary elements
  // This helps avoid over-analyzing pages
  if (priorityElements.length < 10) {
    setTimeout(() => {
      // Look for other potentially meaningful content, with stricter filters
      const potentialElements = Array.from(document.querySelectorAll('div, span, a'))
        .filter(el => {
          try {
            // More comprehensive checks to avoid unnecessary processing
            if (!el || !el.innerText || shouldIgnoreElement(el)) return false;
            
            const text = el.innerText.trim();
            
            // Require more substantial text for secondary elements
            if (text.length < 30) return false;
            
            // Verify if contains keywords that might indicate sensitive content
            const potentialSensitiveContent = /\b(kill|bomb|hack|sex|porn|nude|fuck|shit|ass)\b/i.test(text);
            
            // Only process elements that might contain sensitive content or are very long
            return potentialSensitiveContent || text.length > 100;
          } catch (err) {
            // Skip elements that cause errors when accessing properties
            return false;
          }
        });
      
      // Limit the number of secondary elements to process
      const limitedElements = potentialElements.slice(0, 20);
      console.log(`AI Content Guardian: Found ${limitedElements.length} secondary elements to analyze`);
      
      // Create batches for remaining elements
      const secondaryBatches = [];
      for (let i = 0; i < limitedElements.length; i += batchSize) {
        secondaryBatches.push(limitedElements.slice(i, i + batchSize));
      }
      
      // Process these batches with a longer delay between batches
      processBatches(secondaryBatches, 0, 250); // 250ms between batches
      
      const endTime = performance.now();
      console.log(`AI Content Guardian: Analysis initiated in ${Math.round(endTime - startTime)}ms`);
    }, 800); // Start secondary analysis after a longer delay
  }
}

// Process element batches with delay between each batch
function processBatches(batches, index, delayBetweenBatches = 100) {
  if (index >= batches.length) {
    console.log("AI Content Guardian: Completed all batch processing");
    return;
  }
  
  const batch = batches[index];
  batch.forEach(analyzeElement);
  
  // Schedule next batch with a delay
  setTimeout(() => {
    processBatches(batches, index + 1, delayBetweenBatches);
  }, delayBetweenBatches);
}

// Analyze a specific element for harmful content
function analyzeElement(element) {
  // Skip elements that should be ignored
  if (shouldIgnoreElement(element)) {
    return;
  }
  
  // Skip elements that have already been processed
  if (element.hasAttribute('data-ai-guardian-processed')) {
    return;
  }
  
  // Skip elements that don't have enough text content
  // Add safety check for undefined or null innerText
  if (!element.innerText) {
    return;
  }
  const text = element.innerText.trim();
  if (text.length < 10) {
    return;
  }
  
  // Mark this element as processed
  element.setAttribute('data-ai-guardian-processed', 'true');
  
  // Skip non-meaningful content (common UI text, navigational elements)
  if (text.length < 20 && (
    /menu|navigation|search|copyright|terms|privacy|sign in|login|home|about/i.test(text) ||
    element.tagName === 'BUTTON' ||
    element.tagName === 'NAV' ||
    element.closest('nav') ||
    element.closest('header') ||
    element.closest('footer')
  )) {
    return;
  }
  
  // Check cache first - much faster than API calls
  if (analyzedTextCache.has(text)) {
    const cachedResult = analyzedTextCache.get(text);
    handleAnalysisResult(element, cachedResult);
    return;
  }
  
  // Do a quick local pre-check to avoid unnecessary API calls
  // This helps reduce the number of elements that need full analysis
  const quickCheck = /\b(fuck|shit|ass|porn|nude|sex|bomb|explosive|hack|break in|harm|kill|suicide)\b/i.test(text);
  
  // If quick check doesn't find potentially harmful content in smaller text, skip full analysis
  if (!quickCheck && text.length < 100) {
    return;
  }
  
  // Avoid white flash during analysis
  if (extensionSettings.autoRephrase) {
    // Use a more subtle processing indicator
    element.style.transition = 'opacity 0.2s ease';
    element.style.opacity = '0.95';
  }
  
  // Request analysis with dynamic timing based on text length
  const timeout = Math.min(50 + Math.floor(text.length / 100), 200); // Progressive delay based on text length
  
  setTimeout(() => {
    // Send text to background script for analysis
    chrome.runtime.sendMessage(
      { type: 'ANALYZE_TEXT', text },
      (result) => {
        // Restore normal appearance
        if (extensionSettings.autoRephrase) {
          element.style.opacity = '1';
        }
        
        if (result && !result.error) {
          // Cache the result
          analyzedTextCache.set(text, result);
          // Handle the result
          handleAnalysisResult(element, result);
        }
      }
    );
  }, timeout);
}

// Process analysis results and modify the DOM if needed
function handleAnalysisResult(element, result) {
  if (!result.isHarmful || result.category === 'safe') {
    return; // Content is safe, no action needed
  }
  
  // Apply modifications based on settings
  if (extensionSettings.showWarnings) {
    addWarningIndicator(element, result);
  }
  
  if (extensionSettings.autoRephrase) {
    rephraseContent(element, result);
  } else {
    // If not auto-rephrasing, still add a subtle indicator
    element.classList.add('ai-guardian-flagged');
  }
}

// Add a warning indicator to harmful content
function addWarningIndicator(element, result) {
  // Check if an indicator already exists
  if (element.querySelector('.ai-guardian-warning')) {
    return; // Avoid adding duplicate indicators
  }

  const warningBadge = document.createElement('span');
  warningBadge.className = `ai-guardian-warning ai-guardian-${result.category}`;
  warningBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-triangle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  
  const tooltip = document.createElement('span');
  tooltip.className = 'ai-guardian-tooltip';
  tooltip.textContent = result.explanation;
  
  warningBadge.appendChild(tooltip);
  
  // Position relative to the element - use a safer approach that preserves layout
  const elementPosition = getComputedStyle(element).position;
  if (elementPosition === 'static') {
    // Only apply relative if it's static to avoid breaking layouts
    element.style.position = 'relative';
  }
  
  // Add the warning badge
  element.appendChild(warningBadge);
}

// Rephrase harmful content
function rephraseContent(element, result) {
  // Avoid rephrasing already modified content
  if (element.classList.contains('ai-guardian-rephrased') || 
      element.querySelector('.ai-guardian-rephrased')) {
    element.classList.remove('ai-guardian-processing');
    return;
  }
  
  // Mark element as being processed
  element.classList.add('ai-guardian-processing');
  
  // Save original element attributes to preserve layout
  const originalDisplay = element.style.display;
  const originalTagName = element.tagName.toLowerCase();
  const originalClasses = Array.from(element.classList)
    .filter(cls => !cls.startsWith('ai-guardian-'))
    .join(' ');
  
  // Request the rephrased version
  chrome.runtime.sendMessage(
    { type: 'REPHRASE_TEXT', text: result.text, category: result.category },
    (rephraseResult) => {
      if (rephraseResult && !rephraseResult.error) {
        // Create wrapper that preserves the original element's type and styling
        const wrapper = document.createElement('span');
        wrapper.className = `ai-guardian-rephrased ${originalClasses}`;
        
        // Use innerText for plain text to avoid HTML injection
        // This helps preserve page structure and prevent layout issues
        if (originalTagName === 'p' || originalTagName === 'span' || originalTagName === 'div') {
          wrapper.textContent = rephraseResult.rephrased;
        } else {
          // For other elements, we'll need to be careful with innerHTML
          wrapper.textContent = rephraseResult.rephrased;
        }
        
        // Store the original text for reference
        wrapper.setAttribute('data-original-text', result.text);
        
        // Preserve original element display style
        if (originalDisplay) {
          wrapper.style.display = originalDisplay;
        }
        
        // Replace the content rather than the entire element
        // This helps maintain the DOM hierarchy and structure
        element.textContent = '';
        element.appendChild(wrapper);
        
        // Add indicator that content was modified
        const indicator = document.createElement('span');
        indicator.className = 'ai-guardian-indicator';
        indicator.title = 'This content was automatically rephrased';
        indicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
        
        // Position the indicator at the end of the content
        wrapper.appendChild(indicator);
      }
      
      // Remove processing class
      element.classList.remove('ai-guardian-processing');
    }
  );
}

// Remove all modifications made by the extension
function removeAllModifications() {
  // Remove warning badges
  document.querySelectorAll('.ai-guardian-warning').forEach(el => el.remove());
  
  // Remove indicators
  document.querySelectorAll('.ai-guardian-indicator').forEach(el => el.remove());
  
  // Restore original text
  document.querySelectorAll('.ai-guardian-rephrased').forEach(el => {
    const parent = el.parentElement;
    const originalText = el.getAttribute('data-original-text');
    if (originalText && parent) {
      parent.textContent = originalText;
    }
  });
  
  // Remove all flags and processed attributes
  document.querySelectorAll('[data-ai-guardian-processed]').forEach(el => {
    el.removeAttribute('data-ai-guardian-processed');
    el.classList.remove('ai-guardian-flagged');
  });
}

// Check if an element should be ignored
function shouldIgnoreElement(element) {
  // Ignore our own elements or elements containing our modifications
  if (element.classList && Array.from(element.classList).some(c => c.startsWith('ai-guardian-'))) {
    return true;
  }
  
  // Also check parent elements to avoid processing containers with already processed content
  if (element.parentElement && 
      element.parentElement.classList && 
      Array.from(element.parentElement.classList).some(c => c.startsWith('ai-guardian-'))) {
    return true;
  }
  
  // Check if this element contains any of our modified elements
  if (element.querySelector('.ai-guardian-rephrased, .ai-guardian-warning, .ai-guardian-indicator, .ai-guardian-flagged')) {
    return true;
  }
  
  // Ignore specific tags
  if (IGNORE_TAGS.includes(element.tagName)) {
    return true;
  }
  
  // Ignore elements with specific classes
  if (element.classList && IGNORE_CLASS_PATTERNS.some(pattern => 
    Array.from(element.classList).some(c => pattern.test(c))
  )) {
    return true;
  }
  
  // Ignore elements that have custom styles applied by the extension
  if (element.style && (
      element.style.position === 'relative' || 
      element.style.opacity !== '' ||
      element.style.transition !== ''
  )) {
    // Double check if this was applied by our extension
    if (element.hasAttribute('data-ai-guardian-processed')) {
      return true;
    }
  }
  
  return false;
}

// Start the extension
initializeExtension();
