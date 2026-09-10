// index.ts — barrel export for the Project Collaboration feature.
export { CollaborationWorkspace } from './components/CollaborationWorkspace';
export { ProjectCollaborationTab } from './components/ProjectCollaborationTab';
export { useCollabStore } from './store';
export { useEnsureChannel, useMessages, useSendMessage } from './hooks';
