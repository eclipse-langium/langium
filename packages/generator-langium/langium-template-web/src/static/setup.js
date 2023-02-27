import { MonacoEditorLanguageClientWrapper } from './monaco-editor-wrapper/index.js';
import { buildWorkerDefinition } from "./monaco-editor-workers/index.js";
import monarchSyntax from "./syntaxes/<%= language-id %>.monarch.js";

buildWorkerDefinition('./monaco-editor-workers/workers', new URL('', window.location.href).href, false);

MonacoEditorLanguageClientWrapper.addMonacoStyles('monaco-editor-styles');

const client = new MonacoEditorLanguageClientWrapper();
const editorConfig = client.getEditorConfig();
editorConfig.setMainLanguageId('<%= language-id %>');

editorConfig.setMonarchTokensProvider(monarchSyntax);

editorConfig.setMainCode(`// <%= RawLanguageName %> is running in the web!`);

editorConfig.theme = 'vs-dark';
editorConfig.useLanguageClient = true;
editorConfig.useWebSocket = false;

const workerURL = new URL('./<%= language-id %>-server-worker.js', import.meta.url);
console.log(workerURL.href);

const lsWorker = new Worker(workerURL.href, {
    type: 'classic',
    name: '<%= LanguageName %> Language Server'
});
client.setWorker(lsWorker);

// keep a reference to a promise for when the editor is finished starting, we'll use this to setup the canvas on load
const startingPromise = client.startEditor(document.getElementById("monaco-editor-root"));