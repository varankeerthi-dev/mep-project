import fs from 'fs';
import path from 'path';

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walk(filePath, fileList);
      }
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allFiles = walk('.');
console.log(`Searching in ${allFiles.length} files...`);

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('item_stock') && (content.includes('insert') || content.includes('update'))) {
    console.log(`Modifies item_stock in: ${file}`);
  }
}
console.log('Search complete.');
