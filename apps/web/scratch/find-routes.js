import fs from 'fs';

const file = 'src/App.tsx';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  console.log(`=== Manufacturing Routes in ${file} ===`);
  lines.forEach((line, index) => {
    if (line.includes('manufacturing') || line.includes('production')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}
