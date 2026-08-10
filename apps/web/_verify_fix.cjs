const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const file = path.resolve(__dirname, 'src/pages/QuotationView.tsx');
const source = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const diags = sf.parseDiagnostics || [];
if (diags.length === 0) {
  console.log('OK: 0 parse errors');
} else {
  console.log(`FAIL: ${diags.length} parse error(s):`);
  for (const d of diags) {
    const pos = d.start;
    const loc = sf.getLineAndCharacterOfPosition(pos);
    console.log(`  L${loc.line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  }
  process.exitCode = 1;
}
