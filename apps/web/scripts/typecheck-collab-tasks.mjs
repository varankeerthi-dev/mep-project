/* Targeted typecheck: builds a program from ONLY the collab-task files as
 * roots (their import closure is pulled in transitively). Uses the real
 * tsconfig options, so cross-file checks are real. Reports ALL errors in the
 * closure, highlighting the touched files. Mirrors typecheck-touched.mjs.
 *
 * Usage: node scripts/typecheck-collab-tasks.mjs   (from apps/web/)
 */
import ts from 'typescript';

const touched = [
  'src/components/tasks/types.ts',
  'src/components/tasks/hooks.ts',
  'src/components/tasks/TaskDetailDrawer.tsx',
  'src/components/tasks/TaskCreateDrawer.tsx',
  'src/components/tasks/index.ts',
  'src/components/tasks/ProjectTaskListView.tsx',
  'src/projects/features/collaboration/api.ts',
  'src/projects/features/collaboration/hooks.ts',
  'src/projects/features/collaboration/types.ts',
  'src/projects/features/collaboration/schemas.ts',
  'src/projects/features/collaboration/store.ts',
  'src/projects/features/collaboration/components/MessageBubble.tsx',
  'src/projects/features/collaboration/components/Composer.tsx',
  'src/projects/features/collaboration/components/TaskCard.tsx',
  'src/projects/features/collaboration/components/ReminderCard.tsx',
  'src/projects/features/collaboration/components/ReminderCreateDrawer.tsx',
  'src/projects/features/collaboration/components/ProjectCollaborationTab.tsx',
  'src/projects/features/collaboration/components/CreateChannelDialog.tsx',
  'src/projects/features/collaboration/components/ProjectListRail.tsx',
  'src/projects/features/collaboration/components/CollaborationWorkspace.tsx',
  'src/projects/features/collaboration/components/CollabModuleRail.tsx',
  'src/projects/features/collaboration/components/ChannelHeader.tsx',
  'src/projects/features/collaboration/components/MessageList.tsx',
  'src/projects/features/collaboration/components/ThreadRail.tsx',
  'src/projects/features/collaboration/components/ThreadPane.tsx',
  'src/projects/features/collaboration/components/ThreadSummary.tsx',
  'src/projects/features/collaboration/components/ReactionBar.tsx',
  'src/projects/features/collaboration/components/UserAvatar.tsx',
  'src/projects/features/collaboration/components/LinkedEntityChips.tsx',
  'src/projects/features/collaboration/components/AttachmentPreview.tsx',
  'src/projects/features/collaboration/components/DailyReportCard.tsx',
  'src/components/tasks/PersonalTaskListView.tsx',
  'src/components/tasks/ReminderListView.tsx',
  'src/pages/TasksPage.tsx',
];

const cfg = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, '.');
const program = ts.createProgram(touched, parsed.options);
const inClosure = new Set(program.getSourceFiles().map((s) => s.fileName.split(/[\\/]/).join('/')));
let touchedErrors = 0;
for (const file of program.getSourceFiles()) {
  const f = file.fileName.split(/[\\/]/).join('/');
  if (touched.some((r) => f.endsWith(r))) {
    const fileDiags = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];
    for (const d of fileDiags) {
      touchedErrors++;
      const { line, character } = file.getLineAndCharacterOfPosition(d.start);
      console.log(`TOUCHED  ${f}:${line + 1}:${character + 1} - ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    }
  }
}
console.log('---');
console.log(`files in closure: ${inClosure.size} | touched-file errors: ${touchedErrors}`);

