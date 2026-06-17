import fs from 'fs';

const files = [
  'src/approvals/api.ts',
  'src/components/tasks/ProjectTaskListView.tsx',
  'src/modules/Purchase/hooks/usePurchaseQueries.ts',
  'src/supabase.ts',
  'src/database-manufacturing.sql'
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    continue;
  }
  console.log(`\n=== REFERENCES IN ${file} ===`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line.includes('profiles')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}
