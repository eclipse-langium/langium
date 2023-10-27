import { cp, existsSync, mkdirSync } from "node:fs";

if (!existsSync('./syntaxes')) {
    mkdirSync('./syntaxes');
}
if (!existsSync('./static/worker')) {
    mkdirSync('./static/worker');
}

if (!existsSync('./static/monaco-editor-workers/workers')) {
    mkdirSync('./static/monaco-editor-workers/workers', { recursive: true });
}
const logError = (err) => {
    if (err) {
        console.error(err);
    }
};
cp('./node_modules/monaco-editor-workers/dist/index.js', './static/monaco-editor-workers/index.js', logError);
cp('./node_modules/monaco-editor-workers/dist/workers/editorWorker-es.js', './static/monaco-editor-workers/workers/editorWorker-es.js', logError);
cp('./node_modules/monaco-editor-workers/dist/workers/editorWorker-iife.js', './static/monaco-editor-workers/workers/editorWorker-iife.js', logError);
