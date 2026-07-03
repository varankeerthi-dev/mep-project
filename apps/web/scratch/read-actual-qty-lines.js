import fs from 'fs';

const files = [
  'src/pages/manufacturing/JobCardDetail.tsx',
  'src/pages/manufacturing/InventoryReport.tsx',
  'src/pages/manufacturing/ProductionEntryForm.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    continue;
  }
  console.log(`\n=== REFERENCES IN ${file} ===`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line.includes('actual_qty')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}
