/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { LangiumDocumentConfiguration } from '../documents/document';
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
        // TODO create parse document return the astnode
        const docs = this.services.documents.TextDocuments;
        if (docs.keys().includes(nodeDescription.documentUri)) {
            // look up opened documents
            const langDoc = docs.get(nodeDescription.documentUri);
            if (langDoc)
                return this.services.index.AstNodeLocator.astNode(langDoc, nodeDescription.path);
        } else {
            // Just a dirty implementation. We need a service loading document bei URI
            const fileContent = readFileSync(fileURLToPath(nodeDescription.documentUri)).toString();
            const langId = this.services.LanguageMetaData.languageId;
            const document = LangiumDocumentConfiguration.create(nodeDescription.documentUri, langId, 0, fileContent);
            const parseResult = this.services.parser.LangiumParser.parse(document);
            document.parseResult = parseResult;
            return this.services.index.AstNodeLocator.astNode(document, nodeDescription.path);
        }
        return undefined;
    }
}
