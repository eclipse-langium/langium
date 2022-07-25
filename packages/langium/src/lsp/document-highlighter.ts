/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, DocumentHighlight, DocumentHighlightParams } from 'vscode-languageserver';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { getDocument } from '../utils/ast-util';
import { findDeclarationNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { equalURI } from '../utils/uri-utils';
import { ReferenceDescription } from '../workspace/ast-descriptions';
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
        const selectedNode = findDeclarationNodeAtOffset(rootNode, document.textDocument.offsetAt(params.position));
        if (!selectedNode) {
            return undefined;
        }
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            const refs: DocumentHighlight[] = [];
            const includeDeclaration = equalURI(getDocument(targetAstNode).uri, document.uri);
            const options = { onlyLocal: true, includeDeclaration };
            this.references.findReferences(targetAstNode, options).forEach(ref => {
                refs.push(this.createDocumentHighlight(ref));
            });
            return refs;
        }
        return undefined;
    }

    /**
    * Override this method to determine the highlight kind of the given reference.
    */
    protected createDocumentHighlight(reference: ReferenceDescription): DocumentHighlight {
        return DocumentHighlight.create(reference.segment.range);
    }
}
