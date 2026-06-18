import re

filepath = r'c:\Users\admin\mep-project\src\pages\QuotationView.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add generateZohoTemplate import
if 'import { generateZohoTemplate } from' not in content:
    content = content.replace(
        "import { generateProGridQuotationPdf } from '../pdf/proGridQuotationPdf';",
        "import { generateProGridQuotationPdf } from '../pdf/proGridQuotationPdf';\nimport { generateZohoTemplate } from './ZohoTemplate';"
    )

# 2. Update handlePrintAction
handle_print_action_old = """      if (action === 'preview') {
        previewQuotation(template);
      } else if (action === 'download') {
        await downloadPDF(template);
      } else if (action === 'email') {
        alert('Email feature coming soon!');
      } else if (action === 'print') {
        await downloadPDF(template); // Fallback to download for default print
      }"""

handle_print_action_new = """      if (action === 'preview') {
        previewQuotation(template);
      } else if (action === 'preview-tab') {
        await downloadPDF(template, 'preview-tab');
      } else if (action === 'download') {
        await downloadPDF(template, 'download');
      } else if (action === 'email') {
        alert('Email feature coming soon!');
      } else if (action === 'print') {
        await downloadPDF(template, 'print');
      }"""

content = content.replace(handle_print_action_old, handle_print_action_new)

# 3. Update downloadPDF signature and add helper
download_pdf_old = "  const downloadPDF = async (template) => {\n    try {\n      if (!quotation) throw new Error('Quotation data is missing');\n\n      const safeFileName = String(quotation.quotation_no || 'quotation')\n        .replace(/[<>:\"/\\\\|?*\\x00-\\x1F]/g, '_')\n        .replace(/\\s+/g, '_');"

download_pdf_new = """  const downloadPDF = async (template, action = 'download') => {
    try {
      if (!quotation) throw new Error('Quotation data is missing');

      const safeFileName = String(quotation.quotation_no || 'quotation')
        .replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, '_')
        .replace(/\\s+/g, '_');

      const handleOutput = (blob) => {
        const url = URL.createObjectURL(blob);
        if (action === 'preview-tab') {
          window.open(url, '_blank');
        } else if (action === 'print') {
          const printWindow = window.open(url, '_blank');
          if (printWindow) {
            printWindow.onload = () => {
              printWindow.print();
            };
          }
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${safeFileName}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 100);
        }
      };"""

content = content.replace(download_pdf_old, download_pdf_new)

# 4. Update usages of .save() inside downloadPDF to handleOutput()
# Classic
content = content.replace("classicDoc.save(`${safeFileName}.pdf`);", "handleOutput(classicDoc.output('blob'));")
# Grid Pro
content = content.replace("gridDoc.save(`${safeFileName}.pdf`);", "handleOutput(gridDoc.output('blob'));")
# Enterprise
content = content.replace("enterpriseDoc.save(`${safeFileName}.pdf`);", "handleOutput(enterpriseDoc.output('blob'));")
# Default
content = content.replace("doc.save(`${safeFileName}.pdf`);", "handleOutput(doc.output('blob'));")

# 5. Fix HTML to PDF handling
content = re.sub(
    r"renderTemplateToPdf\([^)]+\);",
    r"const blob = await \g<0>\n        handleOutput(blob);",
    content
)

# Replace 'await htmlToPdf(container, `${safeFileName}.pdf`);'
content = content.replace(
    "await htmlToPdf(container, `${safeFileName}.pdf`);",
    "const blob = await htmlToPdf(container, `${safeFileName}.pdf`);\n          handleOutput(blob);"
)

# 6. Update ZohoTemplate
zoho_old = """      // Special handling for Zoho Template
      if (template.template_code === 'QTN_ZOHO') {
        // Zoho template not implemented yet, fallback to default
        console.warn('Zoho template not implemented, using default');
        return;
      }"""

zoho_new = """      // Special handling for Zoho Template
      if (template.template_code === 'QTN_ZOHO') {
        try {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          const zohoDoc = generateZohoTemplate(quotationWithTerms, organisation, template);
          handleOutput(zohoDoc.output('blob'));
          return;
        } catch (error) {
          console.error('Error generating Zoho template:', error);
          throw error;
        }
      }"""

content = content.replace(zoho_old, zoho_new)

# 7. Update UI dropdown
ui_old = """                      <button 
                        onClick={() => handlePrintAction('preview')}
                        className="flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors"
                        style={{ padding: '12px' }}
                      >
                        <Eye className="w-4 h-4 text-sky-500" />
                        Preview in New Tab
                      </button>"""

ui_new = """                      <button 
                        onClick={() => handlePrintAction('preview-tab')}
                        className="flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors"
                        style={{ padding: '12px' }}
                      >
                        <Eye className="w-4 h-4 text-sky-500" />
                        Preview in New Tab
                      </button>"""

content = content.replace(ui_old, ui_new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
