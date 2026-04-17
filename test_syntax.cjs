const fs = require('fs');
const code = fs.readFileSync('src/pages/SiteVisits.tsx', 'utf8');
try {
  require('@babel/core').transform(code, {
    presets: ['@babel/preset-react', '@babel/preset-typescript']
  });
  console.log("Syntax OK");
} catch(e) {
  console.error(e.message);
}
