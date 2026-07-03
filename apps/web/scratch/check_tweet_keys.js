import fs from 'fs';

const filePath = 'C:\\Users\\admin\\.gemini\\antigravity-cli\\brain\\3af50511-2c2a-4cb9-a8ef-3a7b463ef7dc\\.system_generated\\steps\\326\\content.md';

try {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n');
  
  let jsonLine = '';
  for (const line of lines) {
    if (line.includes('window.__INITIAL_STATE__=')) {
      jsonLine = line;
      break;
    }
  }
  
  if (!jsonLine) {
    console.log("Could not find window.__INITIAL_STATE__ line.");
    process.exit(1);
  }
  
  const startIndex = jsonLine.indexOf('window.__INITIAL_STATE__=');
  const jsonStart = jsonLine.indexOf('{', startIndex);
  
  let braceCount = 0;
  let jsonEnd = -1;
  for (let i = jsonStart; i < jsonLine.length; i++) {
    if (jsonLine[i] === '{') braceCount++;
    else if (jsonLine[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }
  
  const rawJson = jsonLine.substring(jsonStart, jsonEnd);
  const parsed = JSON.parse(rawJson);
  
  console.log("Tweets entities:", Object.keys(parsed.entities?.tweets?.entities || {}));
  
} catch (e) {
  console.error("Error:", e);
}
