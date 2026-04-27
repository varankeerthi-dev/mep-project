import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from './formatters';

/**
 * Renders a component to an HTML string for template processing
 * Note: This is a simplified version of what a real renderer might do
 */
export function renderTemplate(template: string, data: any): string {
  let rendered = template;
  
  // Replace simple tokens
  Object.keys(data).forEach(key => {
    const value = data[key];
    const token = `{{${key}}}`;
    
    if (typeof value === 'string' || typeof value === 'number') {
      rendered = rendered.split(token).join(String(value));
    }
  });
  
  return rendered;
}

/**
 * Convert OKLCH/OKLAB colors to RGB for html2canvas compatibility
 */
function sanitizeColors(element: HTMLElement) {
  const elements = element.querySelectorAll('*');
  elements.forEach((el: any) => {
    const style = window.getComputedStyle(el);
    const properties = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'fill', 'stroke'];
    
    properties.forEach(prop => {
      const value = style[prop as any];
      if (value && (value.includes('oklch') || value.includes('oklab'))) {
        // Create a temporary element to let the browser resolve the color to RGB
        const temp = document.createElement('div');
        temp.style.color = value;
        document.body.appendChild(temp);
        const resolved = window.getComputedStyle(temp).color;
        document.body.removeChild(temp);
        
        if (resolved && !resolved.includes('oklch') && !resolved.includes('oklab')) {
          el.style[prop as any] = resolved;
        } else {
          // Fallback to a safe color if it still won't resolve
          if (prop.toLowerCase().includes('background')) {
            el.style[prop as any] = 'transparent';
          } else {
            el.style[prop as any] = '#000000';
          }
        }
      }
    });
  });
}

/**
 * Convert HTML element to PDF using html2canvas and jsPDF
 */
export async function htmlToPdf(
  element: HTMLElement,
  filename: string = 'document.pdf'
): Promise<void> {
  try {
    // Sanitize modern CSS colors that html2canvas can't parse
    sanitizeColors(element);
    
    // Convert HTML to canvas with higher scale for better quality
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: true,
      backgroundColor: '#ffffff',
      scrollY: -window.scrollY,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Calculate PDF dimensions (A4)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate image dimensions to fit PDF
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    
    // If content spans multiple pages
    let heightLeft = imgHeight;
    let position = 0;
    
    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;
    
    // Add subsequent pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }
    
    pdf.save(filename);
  } catch (error) {
    console.error('Error converting HTML to PDF:', error);
    throw new Error('Failed to convert HTML to PDF');
  }
}
