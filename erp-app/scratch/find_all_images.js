import fs from 'fs';

const filePath = 'C:\\Users\\admin\\.gemini\\antigravity-cli\\brain\\3af50511-2c2a-4cb9-a8ef-3a7b463ef7dc\\.system_generated\\steps\\326\\content.md';

try {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find all pbs.twimg.com/media URLs
  const mediaRegex = /https:\/\/pbs\.twimg\.com\/media\/[a-zA-Z0-9_-]+\.[a-zA-Z]+/g;
  const urls = content.match(mediaRegex) || [];
  
  const uniqueUrls = [...new Set(urls)];
  console.log("--- FOUND UNIQUE MEDIA URLS ---");
  uniqueUrls.forEach((url, idx) => {
    console.log(`${idx + 1}: ${url}`);
  });
  
} catch (e) {
  console.error(e);
}
