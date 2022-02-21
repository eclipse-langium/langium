/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefaultScopeComputation } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { AstNodeLocator } from '../workspace/ast-node-locator';
import { LangiumDocument, PrecomputedScopes } from '../workspace/documents';
import { isReturnType } from './generated/ast';
import { processTypeNodeWithNodeLocator } from './grammar-util';

export class LangiumGrammarScopeComputation extends DefaultScopeComputation {
    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly processTypeNode: (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => void;

    constructor(services: LangiumServices) {
        super(services);
        this.processTypeNode = processTypeNodeWithNodeLocator(services.index.AstNodeLocator);
    }

    protected processNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
        if (isReturnType(node)) return;
        this.processTypeNode(node, document, scopes);
        super.processNode(node, document, scopes);
    }
}