/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, LocationLink, TypeDefinitionParams } from 'vscode-languageserver';
import { LangiumServices } from '..';
import { References } from '../references/references';
import { AstNode } from '../syntax-tree';
import { findLeafNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling go to type requests.
 */
export interface GoToTypeProvider {
    /**
     * Handles a go to type definition request.
     */
    goToTypeDefinition(document: LangiumDocument, params: TypeDefinitionParams, cancelToken?: CancellationToken): MaybePromise<LocationLink[] | undefined>;
}

export abstract class AbstractGoToTypeProvider implements GoToTypeProvider {

    protected readonly references: References;

    constructor(services: LangiumServices) {
        this.references = services.references.References;
    }

    goToTypeDefinition(document: LangiumDocument, params: TypeDefinitionParams): MaybePromise<LocationLink[] | undefined> {
        const rootNode = document.parseResult.value;
        if (rootNode.$cstNode) {
            const sourceCstNode = findLeafNodeAtOffset(rootNode.$cstNode, document.textDocument.offsetAt(params.position));
            if (sourceCstNode) {
                const nodeDeclaration = this.references.findDeclaration(sourceCstNode);
                if (nodeDeclaration) {
                    return this.collectGoToTypeLocationLinks(nodeDeclaration.element);
                }
            }
        }
        return undefined;
    }

    /**
     * Override this method to implement the logic to generate the expected LocationLink[] for a go to type request for your language.
     */
    abstract collectGoToTypeLocationLinks(element: AstNode): MaybePromise<LocationLink[] | undefined>;
}
