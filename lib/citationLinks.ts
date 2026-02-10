/**
 * Helper for building app links from citations
 */

/**
 * Get absolute or relative URL for a citation
 * @param index - The Elasticsearch index name
 * @param id - The document ID
 * @returns Full URL string
 */
export function citationUrl(index: string, id: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  let path = '';

  switch (index) {
    case 'kb-articles':
      path = `/kb/${id}`;
      break;
    case 'resolutions':
      path = `/resolution/${id}`;
      break;
    case 'tickets':
      path = `/ticket/${id}`;
      break;
    case 'incidents':
      path = `/incident/${id}`;
      break;
    default:
      // Fallback for unknown indices
      path = `/${index}/${id}`;
      break;
  }

  return baseUrl ? `${baseUrl}${path}` : path;
}

/**
 * Format citation for display
 * @param index - The Elasticsearch index name
 * @param id - The document ID
 * @returns Formatted label (e.g., "KB Article: abc123")
 */
export function citationLabel(index: string, id: string): string {
  switch (index) {
    case 'kb-articles':
      return `KB Article: ${id}`;
    case 'resolutions':
      return `Resolution: ${id}`;
    case 'tickets':
      return `Ticket: ${id}`;
    case 'incidents':
      return `Incident: ${id}`;
    default:
      return `${index}:${id}`;
  }
}
