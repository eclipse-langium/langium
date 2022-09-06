/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, DefinitionParams, LocationLink } from 'vscode-languageserver';
import { GrammarConfig } from '../grammar/grammar-config';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { findDeclarationNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling go to definition requests.
 */
export interface GoToDefinitionProvider {
    /**
     * Handle a go to definition request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    goToDefinition(document: LangiumDocument, params: DefinitionParams, cancelToken?: CancellationToken): MaybePromise<LocationLink[] | undefined>;
}

export interface GoToLink {
    source: CstNode
    target: CstNode
    targetDocument: LangiumDocument
}

export class DefaultGoToDefinitionProvider implements GoToDefinitionProvider {

    protected readonly nameProvider: NameProvider;
    protected readonly references: References;
    protected readonly grammarConfig: GrammarConfig;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.references = services.references.References;
        this.grammarConfig = services.parser.GrammarConfig;
    }

    goToDefinition(document: LangiumDocument, params: DefinitionParams): MaybePromise<LocationLink[] | undefined> {
        const rootNode = document.parseResult.value;
        if (rootNode.$cstNode) {
            const cst = rootNode.$cstNode;
            const sourceCstNode = findDeclarationNodeAtOffset(cst, document.textDocument.offsetAt(params.position), this.grammarConfig.nameRegexp);
            if (sourceCstNode) {
                return this.collectLocationLinks(sourceCstNode, params);
            }
        }
        return undefined;
    }

    protected collectLocationLinks(sourceCstNode: CstNode, _params: DefinitionParams): MaybePromise<LocationLink[] | undefined> {
        const goToLink = this.findLink(sourceCstNode);
        if (goToLink) {
            return [LocationLink.create(
                goToLink.targetDocument.textDocument.uri,
                (this.findActualNodeFor(goToLink.target) ?? goToLink.target).range,
                goToLink.target.range,
                goToLink.source.range
            )];
        }
        return undefined;
    }

    protected findLink(source: CstNode): GoToLink | undefined {
        const target = this.references.findDeclarationNode(source);
        if (target?.element) {
            const targetDocument = getDocument(target.element);
            if (target && targetDocument) {
                return { source, target, targetDocument };
            }
        }
        return undefined;
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
