import fs from 'fs';

const filePath = 'C:\\Users\\admin\\.gemini\\antigravity-cli\\brain\\3af50511-2c2a-4cb9-a8ef-3a7b463ef7dc\\.system_generated\\steps\\326\\content.md';

try {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find all script tags
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  
  while ((match = scriptRegex.exec(content)) !== null) {
    const scriptContent = match[1];
    count++;
    if (scriptContent.includes('window.__INITIAL_STATE__')) {
      console.log(`Script ${count} contains window.__INITIAL_STATE__ (length: ${scriptContent.length})`);
    } else if (scriptContent.includes('globalObjects') || scriptContent.includes('tweets') || scriptContent.includes('instructions')) {
      console.log(`Script ${count} looks like data (length: ${scriptContent.length})`);
      console.log(scriptContent.substring(0, 200) + '...\n');
    }
  }
  console.log(`Total script tags found: ${count}`);
} catch (e) {
  console.error(e);
}
