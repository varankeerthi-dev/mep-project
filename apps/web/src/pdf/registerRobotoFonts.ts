import robotoRegularUrl from '../assets/fonts/roboto/Roboto-Regular.ttf?url';
import robotoMediumUrl from '../assets/fonts/roboto/Roboto-Medium.ttf?url';
import robotoBoldUrl from '../assets/fonts/roboto/Roboto-Bold.ttf?url';
import robotoLightUrl from '../assets/fonts/roboto/Roboto-Light.ttf?url';
import type { jsPDF } from 'jspdf';

interface CachedRobotoFonts {
  regular: string;
  medium: string;
  bold: string;
  light: string;
}

let cachedFonts: CachedRobotoFonts | null = null;
let fontLoadingPromise: Promise<CachedRobotoFonts> | null = null;

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function ensureRobotoFontsForJsPdf(doc: jsPDF): Promise<void> {
  if (!cachedFonts) {
    if (!fontLoadingPromise) {
      fontLoadingPromise = Promise.all([
        fetchFontAsBase64(robotoRegularUrl),
        fetchFontAsBase64(robotoMediumUrl),
        fetchFontAsBase64(robotoBoldUrl),
        fetchFontAsBase64(robotoLightUrl),
      ]).then(([regular, medium, bold, light]) => {
        cachedFonts = { regular, medium, bold, light };
        return cachedFonts;
      });
    }
    await fontLoadingPromise;
  }

  if (cachedFonts) {
    doc.addFileToVFS('Roboto-Regular.ttf', cachedFonts.regular);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Medium.ttf', cachedFonts.medium);
    doc.addFont('Roboto-Medium.ttf', 'Roboto', 'medium');

    doc.addFileToVFS('Roboto-Bold.ttf', cachedFonts.bold);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    doc.addFileToVFS('Roboto-Light.ttf', cachedFonts.light);
    doc.addFont('Roboto-Light.ttf', 'Roboto', 'light');
  }
}
