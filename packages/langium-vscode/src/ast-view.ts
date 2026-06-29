/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type * as vscodeType from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type { AstChangedParams, InspectAstResult } from 'langium-inspector/protocol';
import { AST_CHANGED_NOTIFICATION, INSPECT_AST_REQUEST, isInspectAstError } from 'langium-inspector/protocol';

// Minimal interface we use from LanguageClient so we don't need to depend on the full type at runtime
interface InspectorClient {
    sendRequest(method: string, params: unknown): Promise<unknown>;
    onNotification(method: string, handler: (params: unknown) => void): { dispose(): void };
}

export class AstViewProvider implements vscodeType.WebviewViewProvider {

    static readonly viewId = 'langium-inspector.astView';

    private view?: vscodeType.WebviewView;
    private readonly clients = new Map<string, InspectorClient>();
    private readonly notificationDisposables = new Map<string, { dispose(): void }>();
    private activeUri?: string;
    private activeLanguageId?: string;

    constructor(_context: vscodeType.ExtensionContext) {}

    resolveWebviewView(webviewView: vscodeType.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.buildWebviewHtml();

        webviewView.webview.onDidReceiveMessage(msg => {
            this.handleWebviewMessage(msg);
        });

        // If we already have an active document, refresh
        if (this.activeUri && this.activeLanguageId) {
            this.refreshAst(this.activeUri, this.activeLanguageId);
        }
    }

    registerClient(client: LanguageClient, languageId: string): void {
        this.clients.set(languageId, client as unknown as InspectorClient);

        const disposable = client.onNotification(AST_CHANGED_NOTIFICATION, (params: unknown) => {
            const { uri } = params as AstChangedParams;
            if (uri === this.activeUri) {
                this.refreshAst(uri, languageId);
            }
        });
        this.notificationDisposables.get(languageId)?.dispose();
        this.notificationDisposables.set(languageId, disposable);

        // Refresh if the currently open editor uses this language
        if (this.activeLanguageId === languageId && this.activeUri) {
            this.refreshAst(this.activeUri, languageId);
        }
    }

    onActiveEditorChanged(editor: vscodeType.TextEditor): void {
        const langId = editor.document.languageId;
        const uri = editor.document.uri.toString();
        this.activeUri = uri;
        this.activeLanguageId = langId;

        if (this.clients.has(langId)) {
            this.refreshAst(uri, langId);
        } else {
            this.postToView({ type: 'clear', message: `No Langium Inspector registered for language: ${langId}` });
        }
    }

    onSelectionChanged(event: vscodeType.TextEditorSelectionChangeEvent): void {
        const uri = event.textEditor.document.uri.toString();
        if (uri !== this.activeUri) return;
        const offset = event.textEditor.document.offsetAt(event.selections[0].active);
        this.postToView({ type: 'cursorMoved', offset });
    }

    private async refreshAst(uri: string, languageId: string): Promise<void> {
        const client = this.clients.get(languageId);
        if (!client || !this.view) return;
        this.postToView({ type: 'loading' });
        try {
            const result = await client.sendRequest(INSPECT_AST_REQUEST, { uri }) as InspectAstResult;
            if (isInspectAstError(result)) {
                this.postToView({ type: 'error', message: result.error });
            } else {
                this.postToView({ type: 'update', uri: result.uri, languageId: result.languageId, ast: result.ast });
            }
        } catch (e) {
            this.postToView({ type: 'error', message: String(e) });
        }
    }

    private postToView(message: unknown): void {
        this.view?.webview.postMessage(message);
    }

    private async handleWebviewMessage(msg: unknown): Promise<void> {
        const message = msg as { type: string; uri?: string; range?: vscodeType.Range };
        if (message.type !== 'reveal' || !message.uri || !message.range) return;

        const vscode = await import('vscode');
        const uri = vscode.Uri.parse(message.uri);
        const range = new vscode.Range(
            new vscode.Position(message.range.start.line, message.range.start.character),
            new vscode.Position(message.range.end.line, message.range.end.character),
        );
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { selection: range, preserveFocus: true });
    }

    private buildWebviewHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
* { box-sizing: border-box; }
body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    padding: 0;
    margin: 0;
    overflow-x: hidden;
}
#message {
    padding: 8px 12px;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}
#error {
    padding: 8px 12px;
    color: var(--vscode-errorForeground);
    word-break: break-word;
}
#loading {
    padding: 8px 12px;
    color: var(--vscode-descriptionForeground);
}
.tree { list-style: none; padding: 0; margin: 0; }
.node { padding: 0; }
.node-header {
    display: flex;
    align-items: baseline;
    padding: 1px 4px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-radius: 3px;
}
.node-header:hover { background: var(--vscode-list-hoverBackground); }
.node-header.highlighted {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.toggle {
    display: inline-block;
    width: 16px;
    flex-shrink: 0;
    font-size: 10px;
    opacity: 0.7;
    text-align: center;
}
.type-badge {
    color: var(--vscode-symbolIcon-classForeground, #B07D48);
    font-weight: 600;
    margin-right: 4px;
}
.prop-key {
    color: var(--vscode-symbolIcon-fieldForeground, #7CB9F4);
    margin-right: 2px;
    font-size: 0.9em;
    opacity: 0.8;
}
.prop-sep { opacity: 0.5; margin-right: 4px; font-size: 0.9em; }
.name-value { color: var(--vscode-foreground); opacity: 0.85; }
.prim-string { color: var(--vscode-debugTokenExpression-string, #CE9178); }
.prim-number { color: var(--vscode-debugTokenExpression-number, #B5CEA8); }
.prim-bool { color: var(--vscode-debugTokenExpression-boolean, #569CD6); }
.ref-label {
    color: var(--vscode-symbolIcon-referenceForeground, #A9C9B0);
    font-style: italic;
}
.ref-error { color: var(--vscode-errorForeground); font-style: italic; }
.children { list-style: none; padding: 0 0 0 16px; margin: 0; }
.children.collapsed { display: none; }
</style>
</head>
<body>
<div id="message">Open a DSL file supported by a Langium Inspector-enabled language server.</div>
<div id="loading" style="display:none">Loading&#8230;</div>
<div id="error" style="display:none"></div>
<ul id="ast-root" class="tree" style="display:none"></ul>
<script>
(function() {
    const vscode = acquireVsCodeApi();

    const elMessage = document.getElementById('message');
    const elLoading = document.getElementById('loading');
    const elError = document.getElementById('error');
    const elRoot = document.getElementById('ast-root');

    let currentUri = null;
    // flat list of {el, start, end} for cursor→tree sync, populated during render
    let nodeRegions = [];
    let highlighted = null;

    window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'update') {
            currentUri = msg.uri;
            showOnly(elRoot);
            try {
                const ast = JSON.parse(msg.ast);
                renderAst(ast);
            } catch(e) {
                showOnly(elError);
                elError.textContent = 'Failed to parse AST: ' + String(e);
            }
        } else if (msg.type === 'error') {
            showOnly(elError);
            elError.textContent = msg.message;
        } else if (msg.type === 'loading') {
            showOnly(elLoading);
        } else if (msg.type === 'clear') {
            showOnly(elMessage);
            elMessage.textContent = msg.message || 'No AST available.';
        } else if (msg.type === 'cursorMoved') {
            highlightAtOffset(msg.offset);
        }
    });

    function showOnly(el) {
        for (const e of [elMessage, elLoading, elError, elRoot]) {
            e.style.display = e === el ? '' : 'none';
        }
    }

    function renderAst(ast) {
        nodeRegions = [];
        highlighted = null;
        elRoot.innerHTML = '';
        const li = buildNode(ast, null, null);
        if (li) {
            elRoot.appendChild(li);
            // Auto-expand root
            const header = li.querySelector('.node-header');
            const children = li.querySelector('.children');
            if (children && children.classList.contains('collapsed')) {
                children.classList.remove('collapsed');
                const toggle = header.querySelector('.toggle');
                if (toggle) toggle.textContent = '▾';
            }
        }
    }

    // Returns <li> or null (for skipped values)
    function buildNode(value, propKey, propIndex) {
        if (value === null || value === undefined) return null;

        // Primitive leaf
        if (typeof value !== 'object') {
            return buildPrimLeaf(value, propKey, propIndex);
        }

        // Cross-reference object
        if ('$ref' in value || '$error' in value) {
            return buildRefLeaf(value, propKey, propIndex);
        }

        // Array: expand each element
        if (Array.isArray(value)) {
            const fragment = document.createDocumentFragment();
            value.forEach((item, i) => {
                const li = buildNode(item, propKey, i);
                if (li) fragment.appendChild(li);
            });
            // If only one child, return it directly; otherwise wrap in a container li
            const children = Array.from(fragment.children);
            if (children.length === 0) return null;
            if (children.length === 1) return children[0];
            const wrapper = document.createElement('li');
            wrapper.className = 'node';
            const header = buildHeader(null, propKey, null, null, true);
            const childList = document.createElement('ul');
            childList.className = 'children';
            children.forEach(c => childList.appendChild(c));
            wrapper.appendChild(header);
            wrapper.appendChild(childList);
            setupToggle(header, childList);
            return wrapper;
        }

        // AST node object
        return buildObjectNode(value, propKey, propIndex);
    }

    function buildObjectNode(obj, propKey, propIndex) {
        const type = obj['$type'] || null;
        const textRegion = obj['$textRegion'] || null;
        const nameVal = typeof obj['name'] === 'string' ? obj['name'] : null;

        const li = document.createElement('li');
        li.className = 'node';

        const childKeys = Object.keys(obj).filter(k =>
            !k.startsWith('$') && obj[k] !== null && obj[k] !== undefined
        );
        // Also include explicit primitive/ref/array properties
        const hasChildren = childKeys.some(k => {
            const v = obj[k];
            return typeof v === 'object' && v !== null;
        });
        const allLeafChildren = childKeys.every(k => typeof obj[k] !== 'object' || obj[k] === null);
        const hasExpandableChildren = childKeys.some(k => {
            const v = obj[k];
            return v !== null && typeof v === 'object';
        });

        const header = buildHeader(type, propKey, propIndex, nameVal, hasExpandableChildren);

        // Attach textRegion data for navigation
        if (textRegion && textRegion.offset !== undefined) {
            header.dataset.start = String(textRegion.offset);
            header.dataset.end = String(textRegion.end);
            header.dataset.uri = currentUri || '';
            header.dataset.rangeStartLine = String(textRegion.range?.start?.line ?? 0);
            header.dataset.rangeStartChar = String(textRegion.range?.start?.character ?? 0);
            header.dataset.rangeEndLine = String(textRegion.range?.end?.line ?? 0);
            header.dataset.rangeEndChar = String(textRegion.range?.end?.character ?? 0);
            nodeRegions.push({ el: header, start: textRegion.offset, end: textRegion.end });
        }

        header.addEventListener('click', () => onNodeClick(header));

        li.appendChild(header);

        if (hasExpandableChildren || (childKeys.length > 0 && !allLeafChildren) || (childKeys.length > 0)) {
            const childList = document.createElement('ul');
            childList.className = 'children collapsed';

            for (const key of childKeys) {
                const val = obj[key];
                if (val === null || val === undefined) continue;
                if (Array.isArray(val)) {
                    val.forEach((item, i) => {
                        const child = buildNode(item, key, i);
                        if (child) childList.appendChild(child);
                    });
                } else if (typeof val === 'object') {
                    const child = buildNode(val, key, null);
                    if (child) childList.appendChild(child);
                } else {
                    const child = buildPrimLeaf(val, key, null);
                    if (child) childList.appendChild(child);
                }
            }

            if (childList.children.length > 0) {
                li.appendChild(childList);
                setupToggle(header, childList);
            } else {
                // No children rendered, remove toggle
                const toggle = header.querySelector('.toggle');
                if (toggle) { toggle.textContent = ' '; toggle.classList.add('empty'); }
            }
        }

        return li;
    }

    function buildHeader(type, propKey, propIndex, nameVal, hasChildren) {
        const header = document.createElement('div');
        header.className = 'node-header';

        const toggle = document.createElement('span');
        toggle.className = 'toggle';
        toggle.textContent = hasChildren ? '▸' : ' ';
        if (!hasChildren) toggle.classList.add('empty');
        header.appendChild(toggle);

        if (propKey !== null) {
            const keySpan = document.createElement('span');
            keySpan.className = 'prop-key';
            keySpan.textContent = propIndex !== null ? propKey + '[' + propIndex + ']' : propKey;
            header.appendChild(keySpan);
            const sep = document.createElement('span');
            sep.className = 'prop-sep';
            sep.textContent = ':';
            header.appendChild(sep);
        }

        if (type) {
            const badge = document.createElement('span');
            badge.className = 'type-badge';
            badge.textContent = type;
            header.appendChild(badge);
        }

        if (nameVal) {
            const name = document.createElement('span');
            name.className = 'name-value';
            name.textContent = '"' + nameVal + '"';
            header.appendChild(name);
        }

        return header;
    }

    function buildPrimLeaf(value, propKey, propIndex) {
        const li = document.createElement('li');
        li.className = 'node';
        const header = document.createElement('div');
        header.className = 'node-header';

        const toggle = document.createElement('span');
        toggle.className = 'toggle empty';
        toggle.textContent = ' ';
        header.appendChild(toggle);

        if (propKey !== null) {
            const keySpan = document.createElement('span');
            keySpan.className = 'prop-key';
            keySpan.textContent = propIndex !== null ? propKey + '[' + propIndex + ']' : propKey;
            header.appendChild(keySpan);
            const sep = document.createElement('span');
            sep.className = 'prop-sep';
            sep.textContent = ':';
            header.appendChild(sep);
        }

        const valSpan = document.createElement('span');
        if (typeof value === 'string') {
            valSpan.className = 'prim-string';
            valSpan.textContent = '"' + value + '"';
        } else if (typeof value === 'number') {
            valSpan.className = 'prim-number';
            valSpan.textContent = String(value);
        } else if (typeof value === 'boolean') {
            valSpan.className = 'prim-bool';
            valSpan.textContent = String(value);
        } else {
            valSpan.textContent = String(value);
        }
        header.appendChild(valSpan);
        li.appendChild(header);
        return li;
    }

    function buildRefLeaf(ref, propKey, propIndex) {
        const li = document.createElement('li');
        li.className = 'node';
        const header = document.createElement('div');
        header.className = 'node-header';

        const toggle = document.createElement('span');
        toggle.className = 'toggle empty';
        toggle.textContent = ' ';
        header.appendChild(toggle);

        if (propKey !== null) {
            const keySpan = document.createElement('span');
            keySpan.className = 'prop-key';
            keySpan.textContent = propIndex !== null ? propKey + '[' + propIndex + ']' : propKey;
            header.appendChild(keySpan);
            const sep = document.createElement('span');
            sep.className = 'prop-sep';
            sep.textContent = ':';
            header.appendChild(sep);
        }

        if ('$error' in ref) {
            const span = document.createElement('span');
            span.className = 'ref-error';
            span.textContent = '⚠ unresolved: ' + (ref['$refText'] || ref['$error']);
            span.title = ref['$error'] || '';
            header.appendChild(span);
        } else {
            const span = document.createElement('span');
            span.className = 'ref-label';
            span.textContent = '→ ' + (ref['$refText'] || ref['$ref']);
            span.title = ref['$ref'] || '';
            header.appendChild(span);
        }

        li.appendChild(header);
        return li;
    }

    function setupToggle(header, childList) {
        const toggle = header.querySelector('.toggle');
        header.addEventListener('click', () => {
            const collapsed = childList.classList.toggle('collapsed');
            if (toggle) toggle.textContent = collapsed ? '▸' : '▾';
        });
    }

    function onNodeClick(header) {
        const uri = header.dataset.uri;
        const line1 = parseInt(header.dataset.rangeStartLine || '0', 10);
        const char1 = parseInt(header.dataset.rangeStartChar || '0', 10);
        const line2 = parseInt(header.dataset.rangeEndLine || '0', 10);
        const char2 = parseInt(header.dataset.rangeEndChar || '0', 10);
        if (!uri) return;
        vscode.postMessage({
            type: 'reveal',
            uri,
            range: {
                start: { line: line1, character: char1 },
                end: { line: line2, character: char2 }
            }
        });
    }

    function highlightAtOffset(offset) {
        // Find the deepest node whose range contains offset
        let best = null;
        let bestSize = Infinity;
        for (const region of nodeRegions) {
            if (region.start <= offset && offset <= region.end) {
                const size = region.end - region.start;
                if (size < bestSize) {
                    bestSize = size;
                    best = region.el;
                }
            }
        }
        if (best === highlighted) return;
        if (highlighted) highlighted.classList.remove('highlighted');
        highlighted = best;
        if (highlighted) {
            highlighted.classList.add('highlighted');
            // Expand ancestors
            let parent = highlighted.parentElement;
            while (parent) {
                if (parent.classList.contains('children') && parent.classList.contains('collapsed')) {
                    parent.classList.remove('collapsed');
                    const sibHeader = parent.previousElementSibling;
                    if (sibHeader) {
                        const toggle = sibHeader.querySelector('.toggle');
                        if (toggle) toggle.textContent = '▾';
                    }
                }
                parent = parent.parentElement;
            }
            highlighted.scrollIntoView({ block: 'nearest' });
        }
    }
})();
</script>
</body>
</html>`;
    }
}
