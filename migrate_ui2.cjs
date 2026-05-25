const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'CreatePO.tsx');
let content = fs.readFileSync(file, 'utf8');

const uiChunk = fs.readFileSync(path.join(__dirname, 'ui_chunk.txt'), 'utf8');

const startToken = "{/* Line Items Section */}";
const endToken = "{/* Payment Terms Section */}";

const startIndex = content.indexOf(startToken);
const endIndex = content.indexOf(endToken);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + uiChunk + '\\n        ' + content.slice(endIndex);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully injected UI methods into CreatePO.tsx');
} else {
  console.log('Tokens not found!');
}
