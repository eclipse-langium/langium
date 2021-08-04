/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { AstNodeDescription, ScopeProvider } from './scope';

export interface Linker {
    link(node: AstNode, referenceName: string, referenceId: string): AstNode | undefined;
    // TODO should be a collection of AstNodeDescriptions
    linkingCandiates(node: AstNode, referenceName: string, referenceId: string): AstNodeDescription | undefined;
}

export class DefaultLinker implements Linker {
    protected readonly scopeProvider: ScopeProvider;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
    }

    link(node: AstNode, referenceName: string, referenceId: string): AstNode | undefined {
        const description = this.linkingCandiates(node, referenceName, referenceId);
        if (description)
            return this.loadAstNode(description);
        return undefined;
    }

    linkingCandiates(node: AstNode, referenceName: string, referenceId: string): AstNodeDescription | undefined {
        const scope = this.scopeProvider.getScope(node, referenceId);
        return scope.getElement(referenceName);
    }

    loadAstNode(nodeDescription: AstNodeDescription): AstNode | undefined {
        if (nodeDescription.node)
            return nodeDescription.node;
        // TODO create parse document return the astnode
        return undefined;
    }
}
