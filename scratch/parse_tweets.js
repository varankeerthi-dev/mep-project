import fs from 'fs';
import path from 'path';

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
  
  if (jsonEnd === -1) {
    console.log("Could not find matching brace.");
    process.exit(1);
  }
  
  const rawJson = jsonLine.substring(jsonStart, jsonEnd);
  const parsed = JSON.parse(rawJson);
  
  const tweets = parsed.entities?.tweets?.entities || {};
  const users = parsed.entities?.users?.entities || {};
  
  console.log("--- FOUND TWEETS ---");
  for (const tweetId in tweets) {
    const tweet = tweets[tweetId];
    const user = users[tweet.user] || {};
    console.log(`\n[Tweet ID: ${tweetId}] by @${user.screen_name} (${user.name})`);
    console.log(`Text: ${tweet.full_text}`);
    
    const media = tweet.extended_entities?.media || tweet.entities?.media || [];
    if (media.length > 0) {
      console.log("Media:");
      media.forEach((m, idx) => {
        console.log(`  - Image ${idx + 1}: ${m.media_url_https}`);
      });
    }
  }
  
} catch (e) {
  console.error("Error:", e);
}
