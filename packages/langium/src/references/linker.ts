/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocuments } from '../documents/document';
import { AstNodeLocator } from '../index/ast-node-locator';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { AstNodeDescription, ScopeProvider } from './scope';

export interface Linker {
    link(node: AstNode, referenceName: string, referenceId: string): AstNode | undefined;
    // TODO should be a collection of AstNodeDescriptions?
    getCandidate(node: AstNode, referenceName: string, referenceId: string): AstNodeDescription | undefined;
}

export class DefaultLinker implements Linker {
    protected readonly scopeProvider: ScopeProvider;
    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly langiumDocuments: () => LangiumDocuments;

    constructor(services: LangiumServices) {
        this.langiumDocuments = () => services.documents.LangiumDocuments;
        this.scopeProvider = services.references.ScopeProvider;
        this.astNodeLocator = services.index.AstNodeLocator;
    }

    link(node: AstNode, referenceName: string, referenceId: string): AstNode | undefined {
        const description = this.getCandidate(node, referenceName, referenceId);
        if (description)
            return this.loadAstNode(description);
        return undefined;
    }

    getCandidate(node: AstNode, referenceName: string, referenceId: string): AstNodeDescription | undefined {
        const scope = this.scopeProvider.getScope(node, referenceId);
        return scope.getElement(referenceName);
    }

    loadAstNode(nodeDescription: AstNodeDescription): AstNode | undefined {
        if (nodeDescription.node)
            return nodeDescription.node;
        const doc = this.langiumDocuments().createOrGetDocument(nodeDescription.documentUri);
        return this.astNodeLocator.getAstNode(doc, nodeDescription.path);
    }
}
