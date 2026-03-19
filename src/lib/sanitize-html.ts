import DOMPurify from "dompurify";

/**
 * Sanitize HTML to prevent XSS. Safe for use with dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    // Server-side: strip all tags as a safe fallback
    return html.replace(/<[^>]*>/g, "");
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "h2", "h3", "ul", "ol", "li", "hr", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}
