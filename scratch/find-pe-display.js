import fs from 'fs';

function findRefs(file, term) {
  if (!fs.existsSync(file)) return;
  console.log(`\n=== References to ${term} in ${file} ===`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line.includes(term)) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}

findRefs('src/pages/manufacturing/JobCardDetail.tsx', 'productionEntries');
findRefs('src/pages/manufacturing/ProductionEntryForm.tsx', 'existingEntries');
