import fs from 'fs';

const file = 'src/pages/manufacturing/JobCardDetail.tsx';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  console.log(`=== References in ${file} ===`);
  lines.forEach((line, index) => {
    if (line.includes('item_stock') || line.includes('issued_qty') || line.includes('issueMaterials') || line.includes('issue_qty') || line.includes('warehouse')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log(`File not found: ${file}`);
}
