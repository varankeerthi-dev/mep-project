import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TemplateData {
  [key: string]: any;
}

/**
 * Render HTML template with data substitution
 * Replaces {{key}} placeholders with actual data values
 * Supports array looping with {{#array}}...{{/array}} syntax
 */
export function renderHtmlTemplate(template: string, data: TemplateData): string {
  let rendered = template;
  
  // Handle array looping first ({{#items}}...{{/items}})
  rendered = rendered.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, arrayName, content) => {
    const array = data[arrayName];
    if (!Array.isArray(array)) return '';
    
    return array.map((item, index) => {
      let itemContent = content;
      // Replace placeholders within the loop with item data
      Object.keys(item).forEach(key => {
        const placeholder = `{{${key}}}`;
        const value = item[key];
        let displayValue: string;
        if (value === null || value === undefined) {
          displayValue = '';
        } else if (typeof value === 'object') {
          displayValue = JSON.stringify(value);
        } else {
          displayValue = String(value);
        }
        itemContent = itemContent.split(placeholder).join(displayValue);
      });
      // Also add index
      itemContent = itemContent.split('{{index}}').join(String(index + 1));
      return itemContent;
    }).join('');
  });
  
  // Replace all {{key}} placeholders with data values
  Object.keys(data).forEach(key => {
    if (Array.isArray(data[key])) return; // Skip arrays (handled above)
    const placeholder = `{{${key}}}`;
    const value = data[key];
    
    // Handle different value types
    let displayValue: string;
    if (value === null || value === undefined) {
      displayValue = '';
    } else if (typeof value === 'object') {
      displayValue = JSON.stringify(value);
    } else {
      displayValue = String(value);
    }
    
    rendered = rendered.split(placeholder).join(displayValue);
  });
  
  return rendered;
}

/**
 * Convert HTML element to PDF using html2canvas and jsPDF
 */
export async function htmlToPdf(
  element: HTMLElement,
  filename: string = 'document.pdf'
): Promise<void> {
  try {
    // Convert HTML to canvas with higher scale for better quality
    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      logging: false,
    });
    
    // Create PDF with PNG for better quality
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;
    
    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if content is longer than one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Save PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error converting HTML to PDF:', error);
    throw new Error('Failed to convert HTML to PDF');
  }
}

/**
 * Render HTML template in a hidden div and convert to PDF
 */
export async function renderTemplateToPdf(
  template: string,
  data: TemplateData,
  filename: string = 'document.pdf'
): Promise<void> {
  // Create hidden div
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.padding = '20px';
  container.style.background = 'white';
  document.body.appendChild(container);
  
  try {
    // Render template with data
    container.innerHTML = renderHtmlTemplate(template, data);
    
    // Wait for images to load
    const images = container.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
      return new Promise((resolve) => {
        if (img.complete) {
          resolve(true);
        } else {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(true);
        }
      });
    });
    
    await Promise.all(imagePromises);
    
    // Convert to PDF
    await htmlToPdf(container, filename);
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}
