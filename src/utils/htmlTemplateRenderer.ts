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
): Promise<Blob> {
  try {
    sanitizeColors(element);
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollY: -window.scrollY,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;
    
    pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    
    return pdf.output('blob');
  } catch (error) {
    console.error('Error converting HTML to PDF:', error);
    throw new Error('Failed to convert HTML to PDF');
  }
}

/**
 * Render HTML template string to PDF
 * Creates a temporary DOM element, renders the template, and converts to PDF
 */
export async function renderTemplateToPdf(
  htmlTemplate: string,
  data: any,
  filename: string = 'document.pdf'
): Promise<Blob> {
  try {
    const renderedHtml = renderTemplate(htmlTemplate, data);
    
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.padding = '20px';
    container.style.background = '#ffffff';
    container.innerHTML = renderedHtml;
    
    document.body.appendChild(container);
    
    const blob = await htmlToPdf(container, filename);
    
    document.body.removeChild(container);
    
    return blob;
  } catch (error) {
    console.error('Error rendering template to PDF:', error);
    throw new Error('Failed to render template to PDF');
  }
}
