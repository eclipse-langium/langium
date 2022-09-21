/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefaultScopeComputation } from '../../references/scope-computation';
import { DefaultScopeProvider, Scope } from '../../references/scope-provider';
import { LangiumServices } from '../../services';
import { AstNode, AstNodeDescription, ReferenceInfo } from '../../syntax-tree';
import { findRootNode, getDocument } from '../../utils/ast-util';
import { stream, Stream } from '../../utils/stream';
import { LangiumDocument, PrecomputedScopes } from '../../workspace/documents';
import { isReturnType } from '../generated/ast';
import { processActionNodeWithNodeDescriptionProvider, processTypeNodeWithNodeLocator } from '../internal-grammar-util';

export class LangiumGrammarScopeProvider extends DefaultScopeProvider {
    constructor(services: LangiumServices) {
        super(services);
    }

    getScope(context: ReferenceInfo): Scope {
        const referenceType = this.reflection.getReferenceType(context);
        if (referenceType !== 'AbstractType') return super.getScope(context);

        const scopes: Array<Stream<AstNodeDescription>> = [];
        const precomputed = getDocument(context.container).precomputedScopes;
        const rootNode = findRootNode(context.container);
        if (precomputed && rootNode) {
            const allDescriptions = precomputed.get(rootNode);
            const parserRuleScopesArray: AstNodeDescription[] = [];
            const scopesArray: AstNodeDescription[] = [];
            if (allDescriptions.length > 0) {
                for (const description of allDescriptions) {
                    if (this.reflection.isSubtype(description.type, 'ParserRule')) {
                        parserRuleScopesArray.push(description);
                    } else if (this.reflection.isSubtype(description.type, referenceType)) {
                        scopesArray.push(description);
                    }
                }
                scopes.push(stream(
                    scopesArray.concat(
                        parserRuleScopesArray.filter(parserRule => !scopesArray.some(e => e.name === parserRule.name))
                    )
                ));
            }
        }

        let result: Scope = this.getGlobalScope(referenceType);
        for (let i = scopes.length - 1; i >= 0; i--) {
            result = this.createScope(scopes[i], result);
        }

        return result;
    }
}

export class LangiumGrammarScopeComputation extends DefaultScopeComputation {
    protected readonly processTypeNode: (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => void;
    protected readonly processActionNode: (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => void;

    constructor(services: LangiumServices) {
        super(services);
        this.processTypeNode = processTypeNodeWithNodeLocator(services.workspace.AstNodeLocator);
        this.processActionNode = processActionNodeWithNodeDescriptionProvider(services.workspace.AstNodeDescriptionProvider);
    }

    protected processNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
        if (isReturnType(node)) return;
        this.processTypeNode(node, document, scopes);
        this.processActionNode(node, document, scopes);
        super.processNode(node, document, scopes);
    }
}
