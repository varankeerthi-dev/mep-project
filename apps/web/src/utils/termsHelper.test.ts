import { describe, it, expect, vi } from 'vitest';
import { formatTermsTemplateToText, parseTermsIntoLines } from './termsHelper';
import { generateClassicQuotationTemplate } from '../pages/ClassicQuotationTemplate';
import { generateZohoTemplate } from '../pages/ZohoTemplate';
import { generateProGridQuotationPdf } from '../pdf/proGridQuotationPdf';

vi.mock('../pdf/registerRobotoFonts', () => ({
  ensureRobotoFontsForJsPdf: vi.fn().mockResolvedValue(undefined)
}));

import { generateSakthiPdf } from '../pdf/sakthiTemplatePdf';

describe('Terms & Conditions Utilities', () => {
  const sampleTemplate = {
    id: 'tmpl-1',
    name: 'Standard MEP Terms',
    sections: [
      {
        id: 'sec-1',
        title: 'Payment Terms',
        display_order: 1,
        items: [
          { id: 'it-1', content: '50% advance along with order confirmation', item_type: 'bullet' },
          { id: 'it-2', content: '50% before dispatch of materials', item_type: 'bullet' }
        ]
      },
      {
        id: 'sec-2',
        title: 'Delivery & Freight',
        display_order: 2,
        items: [
          { id: 'it-3', content: '2 to 3 weeks from receipt of advance', item_type: 'bullet' },
          { id: 'it-4', content: 'Freight extra at actuals', item_type: 'bullet' }
        ]
      }
    ]
  };

  describe('formatTermsTemplateToText', () => {
    it('formats a structured template with sections and items into human-editable text', () => {
      const text = formatTermsTemplateToText(sampleTemplate);
      expect(text).toContain('1. Payment Terms');
      expect(text).toContain('• 50% advance along with order confirmation');
      expect(text).toContain('2. Delivery & Freight');
      expect(text).toContain('• 2 to 3 weeks from receipt of advance');
    });

    it('returns custom text directly when template already contains customized text', () => {
      const customized = {
        ...sampleTemplate,
        text: 'Customized terms: Net 45 days after inspection.'
      };
      const text = formatTermsTemplateToText(customized);
      expect(text).toBe('Customized terms: Net 45 days after inspection.');
    });

    it('handles JSON stringified template gracefully', () => {
      const stringified = JSON.stringify(sampleTemplate);
      const text = formatTermsTemplateToText(stringified);
      expect(text).toContain('1. Payment Terms');
    });

    it('returns empty string for null or undefined input', () => {
      expect(formatTermsTemplateToText(null)).toBe('');
      expect(formatTermsTemplateToText(undefined)).toBe('');
    });
  });

  describe('parseTermsIntoLines', () => {
    it('extracts lines from custom_content with edited text', () => {
      const customContent = {
        text: 'Payment within 30 days.\nGoods once sold will not be taken back.\nAll disputes subject to Chennai jurisdiction.',
        template_id: 'tmpl-1',
        sections: sampleTemplate.sections
      };
      const lines = parseTermsIntoLines(customContent);
      expect(lines).toEqual([
        'Payment within 30 days.',
        'Goods once sold will not be taken back.',
        'All disputes subject to Chennai jurisdiction.'
      ]);
    });

    it('extracts lines from raw string', () => {
      const rawText = 'Line 1\nLine 2\n\nLine 3';
      const lines = parseTermsIntoLines(rawText);
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('extracts lines from structured template sections when text is absent', () => {
      const lines = parseTermsIntoLines(sampleTemplate);
      expect(lines).toContain('1. Payment Terms');
      expect(lines).toContain('   • 50% advance along with order confirmation');
      expect(lines).toContain('2. Delivery & Freight');
    });

    it('handles JSON string containing custom content object', () => {
      const jsonStr = JSON.stringify({
        text: 'Custom term 1\nCustom term 2'
      });
      const lines = parseTermsIntoLines(jsonStr);
      expect(lines).toEqual(['Custom term 1', 'Custom term 2']);
    });
  });

  describe('Template & PDF Generators with Terms', () => {
    const mockOrg = {
      name: 'Test Engineering Corp',
      address: '123 Industrial Estate',
      gstin: '33AAAAA0000A1Z5',
      state: 'Tamil Nadu',
      email: 'info@test.com',
      phone: '9876543210'
    };

    const mockQuotation = {
      id: 'quote-123',
      quotation_no: 'QT-2026-0001',
      date: '2026-10-06',
      grand_total: 150000,
      subtotal: 127118.64,
      total_tax: 22881.36,
      items: [
        {
          id: 'item-1',
          description: 'Copper Piping 22mm',
          qty: 10,
          rate: 12711.86,
          line_total: 127118.64,
          tax_percent: 18,
          uom: 'm'
        }
      ],
      terms_conditions: {
        text: 'Custom Term A: Payment 100% advance.\nCustom Term B: Delivery in 5 days.',
        template_id: 'tmpl-1'
      }
    };

    it('generates Classic Quotation PDF without crashing when terms_conditions is an object', () => {
      const doc = generateClassicQuotationTemplate(mockQuotation, mockOrg, { show_terms: true });
      expect(doc).toBeDefined();
      expect(doc.output).toBeTypeOf('function');
    });

    it('generates Zoho Quotation PDF without crashing when terms_conditions is an object', () => {
      const doc = generateZohoTemplate(mockQuotation, mockOrg, {});
      expect(doc).toBeDefined();
      expect(doc.output).toBeTypeOf('function');
    });

    it('generates ProGrid Quotation PDF without crashing when terms_conditions is an object', () => {
      const doc = generateProGridQuotationPdf(mockQuotation as any, mockOrg, {});
      expect(doc).toBeDefined();
      expect(doc.output).toBeTypeOf('function');
    });

    it('generates Sakthi Quotation PDF without crashing when terms_conditions is an object', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        arrayBuffer: async () => new ArrayBuffer(8)
      } as any);

      try {
        const doc = await generateSakthiPdf(mockQuotation, mockOrg, 'Quotation');
        expect(doc).toBeDefined();
        expect(doc.output).toBeTypeOf('function');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
