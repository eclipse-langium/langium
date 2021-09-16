/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Range, RenameParams, TextDocumentPositionParams, TextEdit, WorkspaceEdit } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-textdocument';
import { LangiumDocument } from '../documents/document';
import { isNamed, NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { findLeafNodeAtOffset } from '../utils/ast-util';
import { toRange } from '../utils/cst-util';
import { ReferenceFinder } from './reference-finder';

export interface RenameHandler {
    renameElement(document: LangiumDocument, params: RenameParams): WorkspaceEdit | undefined;
    prepareRename(document: LangiumDocument, params: TextDocumentPositionParams): Range | undefined;
}

export class DefaultRenameHandler implements RenameHandler {

    protected readonly referenceFinder: ReferenceFinder
    protected readonly references: References
    protected readonly nameProvider: NameProvider

    constructor(services: LangiumServices) {
        this.referenceFinder = services.lsp.ReferenceFinder;
        this.references = services.references.References;
        this.nameProvider = services.references.NameProvider;
    }

    renameElement(document: LangiumDocument, params: RenameParams): WorkspaceEdit | undefined {
        const changes: Record<string, TextEdit[]> = {};
        this.referenceFinder.findReferences(document, params, true).forEach(location => {
            changes[location.uri]
                ? changes[location.uri].push(TextEdit.replace(location.range, params.newName))
                : changes[location.uri] = [TextEdit.replace(location.range, params.newName)];
        });
        return { changes };
    }

    prepareRename(document: LangiumDocument, params: TextDocumentPositionParams): Range | undefined {
        return this.renameNodeRange(document, params.position);
    }

    protected renameNodeRange(doc: LangiumDocument, position: Position): Range | undefined {
        const rootNode = doc.parseResult.value.$cstNode;
        const offset = doc.textDocument.offsetAt(position);
        if (rootNode && offset) {
            const leafNode = findLeafNodeAtOffset(rootNode, offset);
            if (!leafNode) {
                return undefined;
            }
            const isCrossRef = this.references.findDeclaration(leafNode);
            // return range if selected CstNode is the name node or it is a crosslink which points to a declaration
            if (isCrossRef || this.isNameNode(leafNode)) {
                return toRange(leafNode, doc);
            }
        }
        return undefined;
    }

    protected isNameNode(leafNode: CstNode | undefined): boolean | undefined {
        return leafNode?.element && isNamed(leafNode.element) && leafNode === this.nameProvider.getNameNode(leafNode.element);
    }
}
