/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, DefinitionParams, LocationLink } from 'vscode-languageserver';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { findLeafNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling go to definition requests.
 */
export interface GoToResolver {
    /**
     * Handle a go to definition request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    goToDefinition(document: LangiumDocument, params: DefinitionParams, cancelToken?: CancellationToken): MaybePromise<LocationLink[] | undefined>;
}

export class DefaultGoToResolverProvider implements GoToResolver {

    protected readonly nameProvider: NameProvider;
    protected readonly references: References;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.references = services.references.References;
    }

    goToDefinition(document: LangiumDocument, params: DefinitionParams): MaybePromise<LocationLink[] | undefined> {
        const rootNode = document.parseResult.value;
        const targetCstNodes: Array<{ source: CstNode, target: CstNode, targetDocument: LangiumDocument }> = [];
        if (rootNode.$cstNode) {
            const cst = rootNode.$cstNode;
            const sourceCstNode = findLeafNodeAtOffset(cst, document.textDocument.offsetAt(params.position));
            if (sourceCstNode) {
                const targetNode = this.references.findDeclaration(sourceCstNode);
                if (targetNode?.element) {
                    const targetDoc = getDocument(targetNode?.element);
                    if (targetNode && targetDoc) {
                        targetCstNodes.push({ source: sourceCstNode, target: targetNode, targetDocument: targetDoc });
                    }
                }
            }
        }
        return targetCstNodes.map(link => LocationLink.create(
            link.targetDocument.textDocument.uri,
            (this.findActualNodeFor(link.target) ?? link.target).range,
            link.target.range,
            link.source.range
        ));
    }
    protected findActualNodeFor(cstNode: CstNode): CstNode | undefined {
        let actualNode: CstNode | undefined = cstNode;
        while (!actualNode?.element?.$cstNode) {
            if (!actualNode)
                return undefined;
            actualNode = actualNode.parent;
        }
        return actualNode.element.$cstNode;
    }
}
