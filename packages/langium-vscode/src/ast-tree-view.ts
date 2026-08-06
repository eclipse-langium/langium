/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscode from 'vscode';
import type { InspectorController, InspectorState, PlainRange } from './inspector-controller.js';

export interface AstTreeNode {
    label: string;
    description?: string;
    contextValue: 'object' | 'primitive' | 'reference' | 'reference-error' | 'reference-multi';
    icon: vscode.ThemeIcon;
    uri?: string;
    range?: PlainRange;
    offset?: number;
    end?: number;
    children: AstTreeNode[];
    parent?: AstTreeNode;
    collapsible: vscode.TreeItemCollapsibleState;
}

interface Region {
    node: AstTreeNode;
    start: number;
    end: number;
}

export class AstTreeProvider implements vscode.TreeDataProvider<AstTreeNode>, vscode.Disposable {

    static readonly viewId = 'langium-inspector.astTreeView';

    private view?: vscode.TreeView<AstTreeNode>;
    private root?: AstTreeNode;
    private regions: Region[] = [];
    private message?: string;

    private readonly changeEmitter = new vscode.EventEmitter<AstTreeNode | undefined>();
    readonly onDidChangeTreeData = this.changeEmitter.event;

    constructor(controller: InspectorController) {
        controller.onDidChangeState(state => this.onStateChanged(state));
        controller.onDidMoveCursor(({ offset }) => this.onCursorMoved(offset));
        this.onStateChanged(controller.getState());
    }

    attachView(view: vscode.TreeView<AstTreeNode>): void {
        this.view = view;
        this.view.message = this.message;
    }

    getTreeItem(node: AstTreeNode): vscode.TreeItem {
        const item = new vscode.TreeItem(node.label, node.collapsible);
        item.description = node.description;
        item.iconPath = node.icon;
        item.contextValue = node.contextValue;
        if (node.uri && node.range) {
            item.command = {
                command: 'langium-inspector.revealNode',
                title: 'Reveal in Editor',
                arguments: [node]
            };
        }
        return item;
    }

    getChildren(node?: AstTreeNode): AstTreeNode[] {
        if (!node) {
            return this.root ? [this.root] : [];
        }
        return node.children;
    }

    getParent(node: AstTreeNode): AstTreeNode | undefined {
        return node.parent;
    }

    dispose(): void {
        this.changeEmitter.dispose();
    }

    private onStateChanged(state: InspectorState): void {
        this.root = undefined;
        this.regions = [];
        this.message = undefined;

        switch (state.kind) {
            case 'loading':
                this.message = 'Loading…';
                break;
            case 'clear':
            case 'error':
                this.message = state.message;
                break;
            case 'update':
                try {
                    const parsed = JSON.parse(state.ast);
                    this.root = buildNode(parsed, null, null, state.uri, undefined);
                    this.regions = this.root ? collectRegions(this.root) : [];
                } catch (e) {
                    this.message = `Failed to parse AST: ${String(e)}`;
                }
                break;
        }

        if (this.view) {
            this.view.message = this.message;
        }
        this.changeEmitter.fire(undefined);
    }

    private onCursorMoved(offset: number): void {
        if (!this.view || this.regions.length === 0) {
            return;
        }
        let best: AstTreeNode | undefined;
        let bestSize = Infinity;
        for (const region of this.regions) {
            if (region.start <= offset && offset <= region.end) {
                const size = region.end - region.start;
                if (size < bestSize) {
                    bestSize = size;
                    best = region.node;
                }
            }
        }
        if (best) {
            void this.view.reveal(best, { select: true, focus: false, expand: true });
        }
    }
}

// Returns undefined for null/undefined values
function buildNode(value: unknown, propKey: string | null, propIndex: number | null, uri: string | undefined, parent: AstTreeNode | undefined): AstTreeNode | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value !== 'object') {
        return buildPrimitiveLeaf(value as string | number | boolean, propKey, propIndex, parent);
    }
    const obj = value as Record<string, unknown>;
    if ('$ref' in obj || '$error' in obj || '$refs' in obj) {
        return buildReferenceLeaf(obj, propKey, propIndex, parent);
    }
    return buildObjectNode(obj, propKey, propIndex, uri, parent);
}

function buildObjectNode(obj: Record<string, unknown>, propKey: string | null, propIndex: number | null, uri: string | undefined, parent: AstTreeNode | undefined): AstTreeNode {
    const type = typeof obj.$type === 'string' ? obj.$type as string : undefined;
    const nameVal = typeof obj.name === 'string' ? obj.name as string : undefined;
    const isRoot = propKey === null;

    const node = makeNode({
        label: isRoot ? (type ?? 'AstNode') : formatKey(propKey, propIndex),
        description: buildObjectDescription(isRoot, type, nameVal),
        contextValue: 'object',
        icon: new vscode.ThemeIcon('symbol-class'),
        parent
    });
    applyTextRegion(node, uri, obj.$textRegion);

    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (key.startsWith('$') || val === null || val === undefined) {
            continue;
        }
        if (Array.isArray(val)) {
            val.forEach((item, i) => {
                const child = buildNode(item, key, i, uri, node);
                if (child) {
                    node.children.push(child);
                }
            });
        } else {
            const child = buildNode(val, key, null, uri, node);
            if (child) {
                node.children.push(child);
            }
        }
    }

    if (node.children.length > 0) {
        node.collapsible = isRoot ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
    }

    return node;
}

function buildObjectDescription(isRoot: boolean, type: string | undefined, nameVal: string | undefined): string | undefined {
    const parts: string[] = [];
    if (!isRoot && type) {
        parts.push(type);
    }
    if (nameVal !== undefined) {
        parts.push(`"${nameVal}"`);
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
}

function buildPrimitiveLeaf(value: string | number | boolean, propKey: string | null, propIndex: number | null, parent: AstTreeNode | undefined): AstTreeNode {
    const icon = typeof value === 'string' ? 'symbol-string' : typeof value === 'number' ? 'symbol-number' : 'symbol-boolean';
    const rendered = typeof value === 'string' ? `"${value}"` : String(value);
    return makeNode({
        label: propKey !== null ? formatKey(propKey, propIndex) : rendered,
        description: propKey !== null ? rendered : undefined,
        contextValue: 'primitive',
        icon: new vscode.ThemeIcon(icon),
        parent
    });
}

// Handles resolved refs ($ref), unresolved refs ($error), and multi-references ($refs)
function buildReferenceLeaf(ref: Record<string, unknown>, propKey: string | null, propIndex: number | null, parent: AstTreeNode | undefined): AstTreeNode {
    const refText = typeof ref.$refText === 'string' ? ref.$refText as string : undefined;
    const label = propKey !== null ? formatKey(propKey, propIndex) : (refText ?? 'reference');

    if ('$error' in ref) {
        return makeNode({
            label,
            description: `⚠ unresolved: ${refText ?? String(ref.$error)}`,
            contextValue: 'reference-error',
            icon: new vscode.ThemeIcon('warning'),
            parent
        });
    }

    if ('$refs' in ref) {
        const targets = Array.isArray(ref.$refs) ? ref.$refs as string[] : [];
        const node = makeNode({
            label,
            description: `→ ${refText ?? `${targets.length} references`}`,
            contextValue: 'reference-multi',
            icon: new vscode.ThemeIcon('references'),
            collapsible: targets.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            parent
        });
        node.children = targets.map((target, i) => makeNode({
            label: `[${i}]`,
            description: target,
            contextValue: 'reference',
            icon: new vscode.ThemeIcon('references'),
            parent: node
        }));
        return node;
    }

    const refPath = typeof ref.$ref === 'string' ? ref.$ref as string : undefined;
    return makeNode({
        label,
        description: `→ ${refText ?? refPath ?? ''}`,
        contextValue: 'reference',
        icon: new vscode.ThemeIcon('references'),
        parent
    });
}

function makeNode(fields: Omit<AstTreeNode, 'children' | 'collapsible'> & { collapsible?: vscode.TreeItemCollapsibleState }): AstTreeNode {
    return {
        ...fields,
        children: [],
        collapsible: fields.collapsible ?? vscode.TreeItemCollapsibleState.None
    };
}

function formatKey(propKey: string, propIndex: number | null): string {
    return propIndex !== null ? `${propKey}[${propIndex}]` : propKey;
}

function applyTextRegion(node: AstTreeNode, uri: string | undefined, rawRegion: unknown): void {
    if (!uri || typeof rawRegion !== 'object' || rawRegion === null) {
        return;
    }
    const region = rawRegion as { offset?: unknown; end?: unknown; range?: PlainRange };
    if (typeof region.offset === 'number' && typeof region.end === 'number') {
        node.uri = uri;
        node.offset = region.offset;
        node.end = region.end;
        if (region.range) {
            node.range = region.range;
        }
    }
}

function collectRegions(root: AstTreeNode): Region[] {
    const regions: Region[] = [];
    const visit = (node: AstTreeNode): void => {
        if (node.offset !== undefined && node.end !== undefined) {
            regions.push({ node, start: node.offset, end: node.end });
        }
        node.children.forEach(visit);
    };
    visit(root);
    return regions;
}
