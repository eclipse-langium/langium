/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, ImplementationParams, LocationLink } from 'vscode-languageserver';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { findLeafNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling go to implementation requests.
 */
export interface GoToImplementationProvider {
    /**
     * Handles a go to implementation request.
     */
    goToImplementation(document: LangiumDocument, params: ImplementationParams, cancelToken?: CancellationToken): MaybePromise<LocationLink[] | undefined>;
}

export abstract class AbstractGoToImplementationProvider implements GoToImplementationProvider {
    protected readonly references: References;

    constructor(services: LangiumServices) {
        this.references = services.references.References;
    }

    goToImplementation(document: LangiumDocument<AstNode>, params: ImplementationParams, cancelToken = CancellationToken.None): MaybePromise<LocationLink[] | undefined> {
        const rootNode = document.parseResult.value;
        if (rootNode.$cstNode) {
            const sourceCstNode = findLeafNodeAtOffset(rootNode.$cstNode, document.textDocument.offsetAt(params.position));
            if (sourceCstNode) {
                const nodeDeclaration = this.references.findDeclaration(sourceCstNode);
                if (nodeDeclaration) {
                    return this.collectGoToImplementationLocationLinks(nodeDeclaration.element, cancelToken);
                }
            }
        }
    }

    abstract collectGoToImplementationLocationLinks(element: AstNode, cancelToken: CancellationToken): MaybePromise<LocationLink[] | undefined>;

}