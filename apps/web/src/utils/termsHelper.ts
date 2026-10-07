export interface TermsSection {
  id?: string;
  title: string;
  display_order?: number;
  items?: TermsItem[];
}

export interface TermsItem {
  id?: string;
  content: string;
  display_order?: number;
  item_type?: 'bullet' | 'number' | 'text';
}

export interface TermsTemplateLike {
  id?: string;
  name?: string;
  sections?: TermsSection[];
  text?: string;
}

/**
 * Serializes a structured terms template into a human-readable text block for textareas.
 */
export function formatTermsTemplateToText(template: any): string {
  if (!template) return '';
  if (typeof template === 'string') {
    try {
      const parsed = JSON.parse(template);
      if (parsed && typeof parsed === 'object') {
        return formatTermsTemplateToText(parsed);
      }
    } catch {
      return template;
    }
  }

  if (template.text && typeof template.text === 'string' && template.text.trim()) {
    return template.text;
  }

  if (Array.isArray(template.sections)) {
    return template.sections.map((section: any, sIdx: number) => {
      const title = `${sIdx + 1}. ${section.title || 'Terms'}`;
      const items = (section.items || []).map((item: any, iIdx: number) => {
        const prefix = item.item_type === 'bullet' ? '•' : `${iIdx + 1}.`;
        return `   ${prefix} ${item.content || ''}`;
      }).filter((line: string) => line.trim().length > 0).join('\n');
      return items ? `${title}\n${items}` : title;
    }).join('\n\n');
  }

  if (Array.isArray(template)) {
    return template.map((secOrItem: any, idx: number) => {
      if (typeof secOrItem === 'string') return secOrItem;
      if (secOrItem.content) return `${idx + 1}. ${secOrItem.content}`;
      if (secOrItem.title) return `${idx + 1}. ${secOrItem.title}`;
      return '';
    }).filter(Boolean).join('\n');
  }

  return '';
}

/**
 * Parses raw terms (which could be a JSON string, an object with text or sections,
 * or an array of lines) into a clean list of lines for PDF/print generation.
 */
export function parseTermsIntoLines(rawTerms: any): string[] {
  if (!rawTerms) return [];

  let parsed: any = rawTerms;
  if (typeof rawTerms === 'string') {
    try {
      parsed = JSON.parse(rawTerms);
    } catch {
      return rawTerms.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    }
  }

  if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) {
    return parsed.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  }

  if (parsed && Array.isArray(parsed.sections)) {
    const lines: string[] = [];
    parsed.sections.forEach((sec: any, sIdx: number) => {
      lines.push(`${sIdx + 1}. ${sec.title || 'Terms'}`);
      if (Array.isArray(sec.items)) {
        sec.items.forEach((item: any, iIdx: number) => {
          const prefix = item.item_type === 'bullet' ? '•' : `${iIdx + 1}.`;
          lines.push(`   ${prefix} ${item.content || ''}`);
        });
      }
    });
    if (lines.length > 0) return lines;
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item: any) => {
      if (typeof item === 'string') return item.trim();
      return (item.content || item.title || '').trim();
    }).filter((l: string) => l.length > 0);
  }

  if (typeof parsed === 'string') {
    return parsed.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  }

  return [];
}
