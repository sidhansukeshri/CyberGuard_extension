// AI Content Guardian - DOM Utilities
// Provides helper functions for DOM manipulation

/**
 * Safely extracts text from DOM elements while preserving structure
 * @param {Element} element - The DOM element to extract text from
 * @return {Object} - Text content and mapping to original DOM structure
 */
function extractTextWithMapping(element) {
  const TEXT_NODE = 3;
  const textPieces = [];
  const nodeMapping = new Map();
  let currentIndex = 0;
  
  // Recursively process the DOM tree
  function processNode(node) {
    if (node.nodeType === TEXT_NODE) {
      const text = node.textContent.trim();
      if (text.length > 0) {
        const startIndex = currentIndex;
        currentIndex += text.length;
        // Map the text range to this node
        nodeMapping.set([startIndex, currentIndex], node);
        textPieces.push(text);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip AI Guardian elements
      if (node.classList && Array.from(node.classList).some(c => c.startsWith('ai-guardian-'))) {
        return;
      }
      
      // Process children
      Array.from(node.childNodes).forEach(processNode);
    }
  }
  
  processNode(element);
  
  return {
    text: textPieces.join(' '),
    mapping: nodeMapping
  };
}

/**
 * Applies modifications to the DOM based on analysis results
 * @param {Element} element - The element containing text to modify
 * @param {Object} textMapping - Mapping of text ranges to DOM nodes
 * @param {Array} modifications - Array of modification instructions
 */
function applyModifications(element, textMapping, modifications) {
  // Sort modifications in reverse order to avoid invalidating indices
  modifications.sort((a, b) => b.range[0] - a.range[0]);
  
  // Apply each modification
  modifications.forEach(mod => {
    const [start, end] = mod.range;
    
    // Find the node(s) containing this range
    const affectedNodes = findNodesInRange(textMapping, start, end);
    
    // Apply the appropriate modification
    switch (mod.type) {
      case 'highlight':
        highlightNodes(affectedNodes, mod.category);
        break;
      case 'replace':
        replaceText(affectedNodes, mod.original, mod.replacement);
        break;
      case 'warning':
        addWarningToNodes(affectedNodes, mod.message);
        break;
    }
  });
}

/**
 * Finds nodes that contain text in a specific range
 * @param {Map} mapping - Text range to node mapping
 * @param {number} start - Start index
 * @param {number} end - End index
 * @return {Array} - Array of affected nodes
 */
function findNodesInRange(mapping, start, end) {
  const affectedNodes = [];
  
  mapping.forEach((node, range) => {
    const [nodeStart, nodeEnd] = range;
    
    // Check if ranges overlap
    if (!(end <= nodeStart || start >= nodeEnd)) {
      affectedNodes.push({
        node,
        overlap: [
          Math.max(start, nodeStart),
          Math.min(end, nodeEnd)
        ],
        range: [nodeStart, nodeEnd]
      });
    }
  });
  
  return affectedNodes;
}

/**
 * Highlights text nodes with a specific style
 * @param {Array} nodes - Affected nodes with ranges
 * @param {string} category - Category for styling (harmful, offensive, etc.)
 */
function highlightNodes(nodes, category) {
  nodes.forEach(({ node }) => {
    const parent = node.parentNode;
    const span = document.createElement('span');
    span.className = `ai-guardian-highlight ai-guardian-${category}`;
    
    // Replace the text node with the highlighted span
    parent.replaceChild(span, node);
    span.appendChild(node);
  });
}

/**
 * Replaces text in nodes
 * @param {Array} nodes - Affected nodes with ranges
 * @param {string} original - Original text
 * @param {string} replacement - Replacement text
 */
function replaceText(nodes, original, replacement) {
  nodes.forEach(({ node, overlap, range }) => {
    const nodeText = node.textContent;
    const [overlapStart, overlapEnd] = overlap;
    const [rangeStart, rangeEnd] = range;
    
    // Calculate relative position within this node
    const relativeStart = overlapStart - rangeStart;
    const relativeEnd = overlapEnd - rangeStart;
    
    // Create the new text by replacing the overlapping part
    const newText = 
      nodeText.substring(0, relativeStart) + 
      replacement + 
      nodeText.substring(relativeEnd);
    
    // Create a wrapper for replaced text
    const parent = node.parentNode;
    const wrapper = document.createElement('span');
    wrapper.className = 'ai-guardian-replaced';
    wrapper.textContent = newText;
    
    // Store original text as data attribute
    wrapper.setAttribute('data-original-text', nodeText);
    
    // Replace the node
    parent.replaceChild(wrapper, node);
  });
}

/**
 * Adds warning indicators to nodes
 * @param {Array} nodes - Affected nodes
 * @param {string} message - Warning message
 */
function addWarningToNodes(nodes, message) {
  nodes.forEach(({ node }) => {
    const parent = node.parentNode;
    
    // If the parent already has a warning, don't add another
    if (parent.querySelector('.ai-guardian-warning')) {
      return;
    }
    
    // Make sure parent has position for absolute positioning
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    
    // Create warning badge
    const warning = document.createElement('span');
    warning.className = 'ai-guardian-warning';
    warning.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-triangle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    
    // Add tooltip with message
    const tooltip = document.createElement('span');
    tooltip.className = 'ai-guardian-tooltip';
    tooltip.textContent = message;
    warning.appendChild(tooltip);
    
    // Add warning to parent
    parent.appendChild(warning);
  });
}

// Export utilities for use in other scripts
window.DOMGuardianUtils = {
  extractTextWithMapping,
  applyModifications,
  findNodesInRange,
  highlightNodes,
  replaceText,
  addWarningToNodes
};
