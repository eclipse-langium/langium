/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Range, RenameParams, TextDocumentPositionParams, TextEdit, WorkspaceEdit } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-textdocument';
import { isNamed, NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { findLeafNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';
import { ReferenceFinder } from './reference-finder';

/**
 * Language-specific service for handling rename requests and prepare rename requests.
 */
export interface RenameHandler {
    /**
     * Handle a rename request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    renameElement(document: LangiumDocument, params: RenameParams, cancelToken?: CancellationToken): MaybePromise<WorkspaceEdit | undefined>;

    /**
     * Handle a prepare rename request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    prepareRename(document: LangiumDocument, params: TextDocumentPositionParams, cancelToken?: CancellationToken): MaybePromise<Range | undefined>;
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

    async renameElement(document: LangiumDocument, params: RenameParams): Promise<WorkspaceEdit | undefined> {
        const changes: Record<string, TextEdit[]> = {};
        const references = await this.referenceFinder.findReferences(document, { ...params, context: { includeDeclaration: true } });
        if (!Array.isArray(references)) {
            return undefined;
        }
        references.forEach(location => {
            const change = TextEdit.replace(location.range, params.newName);
            if (changes[location.uri]) {
                changes[location.uri].push(change);
            } else {
                changes[location.uri] = [change];
            }
        });
        return { changes };
    }

    prepareRename(document: LangiumDocument, params: TextDocumentPositionParams): MaybePromise<Range | undefined> {
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
                return leafNode.range;
            }
        }
        return undefined;
    }

    protected isNameNode(leafNode: CstNode | undefined): boolean | undefined {
        return leafNode?.element && isNamed(leafNode.element) && leafNode === this.nameProvider.getNameNode(leafNode.element);
    }
}
