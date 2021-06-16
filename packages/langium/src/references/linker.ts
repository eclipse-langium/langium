/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from '../services';
import { AstNode, AstReflection } from '../syntax-tree';
import { ScopeProvider } from './scope';

export interface Linker {
    link(node: AstNode, referenceName: string, referenceId: string): AstNode | undefined;
}

export class DefaultLinker implements Linker {
    protected readonly scopeProvider: ScopeProvider;
    protected readonly reflection: AstReflection;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.reflection = services.AstReflection;
    }

    link(node: AstNode, referenceName: string, referenceId: string): AstNode | undefined {
        const scope = this.scopeProvider.getScope(node, referenceId);
        const description = scope.getElement(referenceName);
        // TODO resolve the node if necessary
        return description?.node;
    }
}
