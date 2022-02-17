/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, DocumentHighlight, DocumentHighlightKind, DocumentHighlightParams } from 'vscode-languageserver';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode, CstNode, Reference } from '../syntax-tree';
import { findLocalReferences, getDocument } from '../utils/ast-util';
import { findLeafNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling document highlight requests.
 */
export interface DocumentHighlighter {
    /**
     * Handle a document highlight request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    findHighlights(document: LangiumDocument, params: DocumentHighlightParams, cancelToken?: CancellationToken): MaybePromise<DocumentHighlight[] | undefined>;
}

export class DefaultDocumentHighlighter implements DocumentHighlighter {
    protected readonly references: References;
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.references = services.references.References;
        this.nameProvider = services.references.NameProvider;
    }

    findHighlights(document: LangiumDocument, params: DocumentHighlightParams): MaybePromise<DocumentHighlight[] | undefined> {
        const rootNode = document.parseResult.value.$cstNode;
        if (!rootNode) {
            return undefined;
        }
        const selectedNode = findLeafNodeAtOffset(rootNode, document.textDocument.offsetAt(params.position));
        if (!selectedNode) {
            return undefined;
        }
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            const refs: Array<[CstNode, DocumentHighlightKind]> = [];
            if (getDocument(targetAstNode).uri.toString() === document.uri.toString()) {
                const nameNode = this.findNameNode(targetAstNode);
                if (nameNode) {
                    refs.push([nameNode, this.getHighlightKind(nameNode)]);
                }
            }
            findLocalReferences(targetAstNode, rootNode.element).forEach(ref => {
                refs.push([ref.$refNode, this.getHighlightKind(ref.$refNode, ref)]);
            });
            return refs.map(([node, kind]) =>
                DocumentHighlight.create(node.range, kind)
            );
        }
        return undefined;
    }

    protected findNameNode(node: AstNode): CstNode | undefined {
        const nameNode = this.nameProvider.getNameNode(node);
        if (nameNode)
            return nameNode;
        return node.$cstNode;
    }

    /**
     * Override this method to determine the highlight kind of the given CST node.
     */
    protected getHighlightKind(node: CstNode, reference?: Reference<AstNode>): DocumentHighlightKind {
        if (reference) {
            return DocumentHighlightKind.Read;
        } else {
            return DocumentHighlightKind.Text;
        }
    }

}
