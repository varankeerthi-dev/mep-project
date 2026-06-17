import fs from 'fs';
import path from 'path';

const searchDir = './';
const excludeDirs = ['.git', 'node_modules', 'dist'];

function searchFiles(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }
    
    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        searchFiles(fullPath);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.sql') || file.endsWith('.json') || file.endsWith('.env') || file.endsWith('.local') || file.endsWith('.ps1')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('postgres://') || content.includes('postgresql://') || content.includes('service_role') || (content.includes('password') && (content.includes('supabase') || content.includes('db') || content.includes('postgres')))) {
            console.log(`Found match in: ${fullPath}`);
            // print lines matching
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (line.includes('postgres') || line.includes('password') || line.includes('service') || line.includes('key')) {
                console.log(`  L${idx+1}: ${line.trim()}`);
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
}

searchFiles(searchDir);
console.log('Search complete.');
