import { Font } from '@react-pdf/renderer';

import manropeRegular from '../assets/fonts/manrope/Manrope-Regular.ttf?url';
import manropeMedium from '../assets/fonts/manrope/Manrope-Medium.ttf?url';
import manropeSemiBold from '../assets/fonts/manrope/Manrope-SemiBold.ttf?url';
import manropeBold from '../assets/fonts/manrope/Manrope-Bold.ttf?url';

let registered = false;

export function ensurePdfFontsRegistered() {
  if (registered) return;

  Font.register({
    family: 'Manrope',
    fonts: [
      { src: manropeRegular, fontWeight: 400 },
      { src: manropeMedium, fontWeight: 500 },
      { src: manropeSemiBold, fontWeight: 600 },
      { src: manropeBold, fontWeight: 700 },
    ],
  });

  registered = true;
}
