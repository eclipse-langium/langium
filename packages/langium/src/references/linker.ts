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
    // TODO should be a collection of AstNodeDescriptions?
    linkingCandiates(node: AstNode, referenceName: string, referenceId: string): AstNodeDescription | undefined;
}

export class DefaultLinker implements Linker {
    protected readonly scopeProvider: ScopeProvider;
    protected readonly services: LangiumServices;

    constructor(services: LangiumServices) {
        this.services = services;
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
        const doc = this.services.documents.Documents.createOrGetDocument(nodeDescription.documentUri);
        return this.services.index.AstNodeLocator.astNode(doc, nodeDescription.path);
    }
}
