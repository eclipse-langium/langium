/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Scope } from '../../references/scope.js';
import type { LangiumServices } from '../../services.js';
import type { AstNode, AstNodeDescription, ReferenceInfo } from '../../syntax-tree.js';
import type { Stream } from '../../utils/stream.js';
import type { AstNodeLocator } from '../../workspace/ast-node-locator.js';
import type { DocumentSegment, LangiumDocument, LangiumDocuments, PrecomputedScopes } from '../../workspace/documents.js';
import type { Grammar } from '../generated/ast.js';
import { EMPTY_SCOPE, MapScope } from '../../references/scope.js';
import { DefaultScopeComputation } from '../../references/scope-computation.js';
import { DefaultScopeProvider } from '../../references/scope-provider.js';
import { findRootNode, getContainerOfType, getDocument, streamAllContents } from '../../utils/ast-util.js';
import { toDocumentSegment } from '../../utils/cst-util.js';
import { stream } from '../../utils/stream.js';
import { AbstractType, Interface, isAction, isGrammar, isParserRule, isReturnType, Type } from '../generated/ast.js';
import { resolveImportUri } from '../internal-grammar-util.js';
import { getActionType } from '../../utils/grammar-util.js';

export class LangiumGrammarScopeProvider extends DefaultScopeProvider {

    protected readonly langiumDocuments: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
    }

    override getScope(context: ReferenceInfo): Scope {
        const referenceType = this.reflection.getReferenceType(context);
        if (referenceType === AbstractType) {
            return this.getTypeScope(referenceType, context);
        } else {
            return super.getScope(context);
        }
    }

    private getTypeScope(referenceType: string, context: ReferenceInfo): Scope {
        let localScope: Stream<AstNodeDescription> | undefined;
        const precomputed = getDocument(context.container).precomputedScopes;
        const rootNode = findRootNode(context.container);
        if (precomputed && rootNode) {
            const allDescriptions = precomputed.get(rootNode);
            if (allDescriptions.length > 0) {
                localScope = stream(allDescriptions).filter(des => des.type === Interface || des.type === Type);
            }
        }

        const globalScope = this.getGlobalScope(referenceType, context);
        if (localScope) {
            return this.createScope(localScope, globalScope);
        } else {
            return globalScope;
        }
    }

    protected override getGlobalScope(referenceType: string, context: ReferenceInfo): Scope {
        const grammar = getContainerOfType(context.container, isGrammar);
        if (!grammar) {
            return EMPTY_SCOPE;
        }
        const importedUris = new Set<string>();
        this.gatherImports(grammar, importedUris);
        let importedElements = this.indexManager.allElements(referenceType, importedUris);
        if (referenceType === AbstractType) {
            importedElements = importedElements.filter(des => des.type === Interface || des.type === Type);
        }
        return new MapScope(importedElements);
    }

    private gatherImports(grammar: Grammar, importedUris: Set<string>): void {
        for (const imp0rt of grammar.imports) {
            const uri = resolveImportUri(imp0rt);
            if (uri && !importedUris.has(uri.toString())) {
                importedUris.add(uri.toString());
                if (this.langiumDocuments.hasDocument(uri)) {
                    const importedDocument = this.langiumDocuments.getOrCreateDocument(uri);
                    const rootNode = importedDocument.parseResult.value;
                    if (isGrammar(rootNode)) {
                        this.gatherImports(rootNode, importedUris);
                    }
                }
            }
        }
    }

}

export class LangiumGrammarScopeComputation extends DefaultScopeComputation {
    protected readonly astNodeLocator: AstNodeLocator;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeLocator = services.workspace.AstNodeLocator;
    }

    protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument): void {
        super.exportNode(node, exports, document);
        if (isParserRule(node)) {
            if (!node.returnType && !node.dataType) {
                // Export inferred rule type as interface
                const typeNode = node.inferredType ?? node;
                exports.push(this.createInterfaceDescription(typeNode, typeNode.name, document));
            }
            streamAllContents(node).forEach(childNode => {
                if (isAction(childNode) && childNode.inferredType) {
                    const typeName = getActionType(childNode);
                    if (typeName) {
                        // Export inferred action type as interface
                        exports.push(this.createInterfaceDescription(childNode, typeName, document));
                    }
                }
            });
        }
    }

    protected override processNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
        if (isReturnType(node)) return;
        this.processTypeNode(node, document, scopes);
        this.processActionNode(node, document, scopes);
        super.processNode(node, document, scopes);
    }

    /**
     * Add synthetic Interface in case of explicitly or implicitly inferred type:<br>
     * cases: `ParserRule: ...;` or `ParserRule infers Type: ...;`
     */
    protected processTypeNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
        const container = node.$container;
        if (container && isParserRule(node) && !node.returnType && !node.dataType) {
            const typeNode = node.inferredType ?? node;
            scopes.add(container, this.createInterfaceDescription(typeNode, typeNode.name, document));
        }
    }

    /**
     * Add synthetic Interface in case of explicitly inferred type:
     *
     * case: `{infer Action}`
     */
    protected processActionNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
        const container = findRootNode(node);
        if (container && isAction(node) && node.inferredType) {
            const typeName = getActionType(node);
            if (typeName) {
                scopes.add(container, this.createInterfaceDescription(node, typeName, document));
            }
        }
    }

    protected createInterfaceDescription(node: AstNode, name: string, document: LangiumDocument = getDocument(node)): AstNodeDescription {
        let nameNodeSegment: DocumentSegment | undefined;
        const nameSegmentGetter = () => nameNodeSegment ??= toDocumentSegment(this.nameProvider.getNameNode(node) ?? node.$cstNode);
        return {
            node,
            name,
            get nameSegment() {
                return nameSegmentGetter();
            },
            selectionSegment: toDocumentSegment(node.$cstNode),
            type: 'Interface',
            documentUri: document.uri,
            path: this.astNodeLocator.getAstNodePath(node)
        };
    }
}
