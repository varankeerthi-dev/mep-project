import fs from 'fs';

const file = 'src/pages/manufacturing/JobCardDetail.tsx';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('totalStockByMaterial') || line.includes('stockByMaterial')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}
