/* Targeted typecheck: builds a program from ONLY the touched job-card files as
 * roots (their import closure is pulled in transitively). Uses the real
 * tsconfig options, so cross-file checks like `satisfies JobCardInsert` are
 * real. Reports ALL errors in the closure, highlighting the touched files. */
import ts from 'typescript';

const touched = [
  'src/api/machineBoard.ts',
  'src/features/manufacturing/repository/jobCardRepository.ts',
  'src/pages/manufacturing/machine-board/MachineBoardDrawer.tsx',
  'src/pages/manufacturing/machine-board/MachineBoardPage.tsx',
  'src/pages/sales/SalesOrderDetail.tsx',
  'src/pages/sales/components/StockCheckPanel.tsx',
  'src/pages/manufacturing/JobCardCreate.tsx',
  'src/pages/QuotationView.tsx',
];

const cfg = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, '.');
const program = ts.createProgram(touched, parsed.options);
const diags = ts.getPreEmitDiagnostics(program);

const inClosure = new Set(program.getSourceFiles().map((s) => s.fileName.split(/[\\/]/).join('/')));
let touchedErrors = 0, otherErrors = 0;
for (const d of diags) {
  if (!d.file) continue;
  const f = d.file.fileName.split(/[\\/]/).join('/');
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  const msg = `${f}:${line + 1}:${character + 1} - ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
  if (touched.some((r) => f.endsWith(r))) { touchedErrors++; console.log('TOUCHED  ' + msg); }
  else { otherErrors++; if (otherErrors <= 15) console.log('closure  ' + msg); }
}
console.log('---');
console.log(`files in closure: ${inClosure.size} | touched-file errors: ${touchedErrors} | other closure errors: ${otherErrors}`);
