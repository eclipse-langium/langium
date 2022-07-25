/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Location,  ReferenceParams } from 'vscode-languageserver';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { AstNode, LeafCstNode } from '../syntax-tree';
import { LangiumServices } from '../services';
import { isReference } from '../utils/ast-util';
import { findDeclarationNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling find references requests.
 */
export interface ReferenceFinder {
    /**
     * Handle a find references request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    findReferences(document: LangiumDocument, params: ReferenceParams, cancelToken?: CancellationToken): MaybePromise<Location[]>;
}

export class DefaultReferenceFinder implements ReferenceFinder {
    protected readonly nameProvider: NameProvider;
    protected readonly references: References;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.references = services.references.References;
    }

    findReferences(document: LangiumDocument, params: ReferenceParams): MaybePromise<Location[]> {
        const rootNode = document.parseResult.value.$cstNode;
        if (!rootNode) {
            return [];
        }

        const selectedNode = findDeclarationNodeAtOffset(rootNode, document.textDocument.offsetAt(params.position));
        if (!selectedNode) {
            return [];
        }

        const refs: Location[] = this.getReferences(selectedNode, params, document);

        return refs;
    }

    protected getReferences(selectedNode: LeafCstNode, params: ReferenceParams, document: LangiumDocument<AstNode>): Location[] {
        const refs: Location[] = [];
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            const options = { includeDeclaration: params.context.includeDeclaration };
            this.references.findReferences(targetAstNode, options).forEach(reference => {
                if (isReference(reference)) {
                    refs.push(Location.create(document.uri.toString(), reference.$refNode.range));
                } else {
                    refs.push(Location.create(reference.sourceUri.toString(), reference.segment.range));
                }
            });
        }
        return refs;
    }
}
