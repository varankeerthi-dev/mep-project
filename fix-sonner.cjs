const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing sonner imports...\n');

// 1. Create proper logger file
const loggerContent = `export const toast = {
  success: (message: string) => console.log(\`✅ \${message}\`),
  error: (message: string) => console.error(\`❌ \${message}\`),
  message: (message: string) => console.log(\`ℹ️ \${message}\`),
  dismiss: () => {},
  promise: () => {},
  loading: (message: string) => console.log(\`⏳ \${message}\`),
}

export function Toaster() {
  return null
}
`;

const libDir = path.join(__dirname, 'src', 'lib');
if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
fs.writeFileSync(path.join(libDir, 'logger.ts'), loggerContent);
console.log('✅ Created src/lib/logger.ts');

// 2. Find and replace imports in all .ts/.tsx files
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.vite') walkDir(fullPath, callback);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      callback(fullPath);
    }
  });
}

let filesChanged = 0;
walkDir(path.join(__dirname, 'src'), (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  content = content.replace(/from ['"]sonner['"]/g, "from '@/lib/logger'");
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`📝 Updated: ${filePath.replace(__dirname, '.')}`);
    filesChanged++;
  }
});

console.log(`\n✅ Updated ${filesChanged} files`);

// 3. Fix vite.config.ts
const viteConfigPath = path.join(__dirname, 'vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
  let viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
  viteConfig = viteConfig.replace(/sonner:\s*path\.resolve\([^)]+\),?\n?/g, '');
  fs.writeFileSync(viteConfigPath, viteConfig);
  console.log('✅ Removed sonner alias from vite.config.ts');
}

// 4. Delete old mock
const oldMockPath = path.join(__dirname, 'src', 'sonner.ts');
if (fs.existsSync(oldMockPath)) {
  fs.unlinkSync(oldMockPath);
  console.log('✅ Deleted src/sonner.ts');
}

console.log('\n🎉 Done! Now run: npm run dev -- --force');