/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, DeclarationParams, LocationLink } from 'vscode-languageserver';
import { GrammarConfig } from '../grammar/grammar-config';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode, LeafCstNode } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { findDeclarationNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';
import { GoToLink } from './definition-provider';

/**
 * Language-specific service for handling go to declaration requests
 */
export interface DeclarationProvider {
    getDeclaration(document: LangiumDocument, params: DeclarationParams, cancelToken?: CancellationToken): MaybePromise<LocationLink[] | undefined>
}

export class DefaultDeclarationProvider implements DeclarationProvider {
    protected readonly grammarConfig: GrammarConfig;
    protected readonly references: References;
    constructor(services: LangiumServices) {
        this.grammarConfig = services.parser.GrammarConfig;
        this.references = services.references.References;
    }
    /**
     * Handles a go to declaration request
     */
    getDeclaration(document: LangiumDocument<AstNode>, params: DeclarationParams): MaybePromise<LocationLink[] | undefined> {
        const rootNode = document.parseResult.value;
        if (rootNode.$cstNode) {
            const sourceCstNode = findDeclarationNodeAtOffset(rootNode.$cstNode, document.textDocument.offsetAt(params.position), this.grammarConfig.nameRegexp);
            if (sourceCstNode) {
                return this.collectLocationLinks(sourceCstNode, params);
            }
        }
        return undefined;
    }

    protected collectLocationLinks(sourceCstNode: LeafCstNode, _params: DeclarationParams): MaybePromise<LocationLink[] | undefined> {
        const goToLink = this.findLink(sourceCstNode);
        if (goToLink)  {
            return [LocationLink.create(
                goToLink.targetDocument.textDocument.uri,
                (goToLink.target.element.$cstNode ?? goToLink.target).range,
                goToLink.target.range,
                goToLink.source.range
            )];
        }
        return undefined;
    }

    protected findLink(source: LeafCstNode): GoToLink | undefined {
        const target = this.references.findDeclarationNode(source);
        if (target?.element) {
            const targetDocument = getDocument(target.element);
            if (targetDocument) {
                return {source, target, targetDocument};
            }
        }
        return undefined;
    }
}