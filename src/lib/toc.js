/**
 * Generates a table of contents from Markdown content
 * @param {string} markdownContent - Raw markdown content
 * @returns {Array} - Array of TOC items with title, level, and anchor properties
 */
// utils/toc.js
export function generateTOC(markdownContent = '') {
  const headingRegex = /^\s*##\s+(.+?)(?:\s+##)?$|^\s*(.+)\r?\n-{3,}\s*$/gm;
  const toc = [];
  let match;

  while ((match = headingRegex.exec(markdownContent)) !== null) {
    let title  = (match[1] || match[2]).trim();
    
    // Strip markdown formatting
    title = title
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold **text**
      .replace(/\*(.*?)\*/g, '$1')      // Remove italic *text*
      .replace(/`(.*?)`/g, '$1')        // Remove inline code `text`
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links [text](url)
      .trim();
    
    const anchor = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    toc.push({ title, anchor, level: 2 });   // 👈 add level
  }

  return toc;
}

  
  /**
   * Renders a TOC as HTML
   * @param {Array} toc - The table of contents array
   * @returns {string} - HTML string of the TOC
   */
  export function renderTOC(toc) {
    if (!toc || toc.length === 0) return '';
    
    let html = '<ul class="toc-list">';
    
    toc.forEach(item => {
      html += `<li class="toc-item toc-level-${item.level}">
        <a href="#${item.anchor}" class="toc-link">${item.title}</a>
      </li>`;
    });
    
    html += '</ul>';
    return html;
  }
  
  /**
   * Save the current reading position to localStorage
   * @param {string} bookSlug - The book's unique identifier
   * @param {number} position - The scroll position
   */
  export function saveReadingPosition(bookSlug, position) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`reading-position-${bookSlug}`, position.toString());
    }
  }
  
  /**
   * Get the saved reading position from localStorage
   * @param {string} bookSlug - The book's unique identifier
   * @returns {number|null} - The saved position or null if not found
   */
  export function getReadingPosition(bookSlug) {
    if (typeof window !== 'undefined') {
      const position = localStorage.getItem(`reading-position-${bookSlug}`);
      return position ? parseInt(position, 10) : null;
    }
    return null;
  }