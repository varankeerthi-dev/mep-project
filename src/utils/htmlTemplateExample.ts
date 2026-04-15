import { renderTemplateToPdf } from './htmlTemplateRenderer';

/**
 * Example: How to use HTML templates for quotations
 * 
 * 1. First, run the SQL migration:
 *    - Run src/database-add-html-template-support.sql in Supabase SQL Editor
 * 
 * 2. Create an HTML template with {{placeholder}} syntax:
 */

const exampleHtmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; }
    .quotation-title { font-size: 18px; color: #666; }
    .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .table th { background: #f0f0f0; padding: 10px; text-align: left; }
    .table td { padding: 10px; border-bottom: 1px solid #ddd; }
    .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">{{organisation_name}}</div>
    <div class="quotation-title">Quotation #{{quotation_no}}</div>
  </div>
  
  <div class="info-row">
    <div><strong>Date:</strong> {{date}}</div>
    <div><strong>Valid Till:</strong> {{valid_till}}</div>
  </div>
  
  <div class="info-row">
    <div><strong>Client:</strong> {{client_name}}</div>
    <div><strong>GSTIN:</strong> {{gstin}}</div>
  </div>
  
  <table class="table">
    <thead>
      <tr>
        <th>Item</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td>{{description}}</td>
        <td>{{qty}}</td>
        <td>{{rate}}</td>
        <td>{{line_total}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>
  
  <div class="total">
    Grand Total: {{grand_total}}
  </div>
</body>
</html>
`;

/**
 * Example data structure
 */
const exampleQuotationData = {
  organisation_name: 'Your Company Name',
  quotation_no: 'QT-0001',
  date: '2026-04-14',
  valid_till: '2026-05-14',
  client_name: 'Client ABC',
  gstin: '29ABCDE1234F1Z5',
  items: [
    { description: 'Product A', qty: 10, rate: 100, line_total: 1000 },
    { description: 'Product B', qty: 5, rate: 200, line_total: 1000 }
  ],
  grand_total: 2000
};

/**
 * Usage example:
 * 
 * 1. Save the HTML template in the database:
 *    INSERT INTO document_templates (template_name, document_type, template_content, template_type)
 *    VALUES ('My HTML Template', 'Quotation', '<your html here>', 'html');
 * 
 * 2. When generating PDF:
 *    const template = await fetchTemplateById(templateId);
 *    if (template.template_type === 'html') {
 *      await renderTemplateToPdf(template.template_content, quotationData, 'quotation.pdf');
 *    }
 */

export { exampleHtmlTemplate, exampleQuotationData };
