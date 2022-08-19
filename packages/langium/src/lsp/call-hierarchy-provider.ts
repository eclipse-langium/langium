/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CallHierarchyIncomingCall, CallHierarchyIncomingCallsParams, CallHierarchyItem, CallHierarchyOutgoingCall, CallHierarchyOutgoingCallsParams, CallHierarchyPrepareParams, CancellationToken, SymbolKind} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { GrammarConfig } from '../grammar/grammar-config';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { findDeclarationNodeAtOffset } from '../utils/cst-util';
import { ReferenceDescription } from '../workspace/ast-descriptions';
import { LangiumDocument, LangiumDocuments } from '../workspace/documents';

/**
 * Language-specific service for handling call hierarchy requests.
 */
export interface CallHierarchyProvider {
    prepareCallHierarchy(document: LangiumDocument, params: CallHierarchyPrepareParams, cancelToken?: CancellationToken): CallHierarchyItem[] | null;

    incomingCalls(params: CallHierarchyIncomingCallsParams,  cancelToken?: CancellationToken): CallHierarchyIncomingCall[] | null;

    outgoingCalls(params: CallHierarchyOutgoingCallsParams, cancelToken?: CancellationToken): CallHierarchyOutgoingCall[] | null;
}

export class DefaultCallHierarchyProvider implements CallHierarchyProvider {
    protected readonly grammarConfig: GrammarConfig;
    protected readonly nameProvider: NameProvider;
    protected readonly documents: LangiumDocuments;
    protected readonly references: References;

    constructor(services: LangiumServices) {
        this.grammarConfig = services.parser.GrammarConfig;
        this.nameProvider = services.references.NameProvider;
        this.documents = services.shared.workspace.LangiumDocuments;
        this.references = services.references.References;
    }

    prepareCallHierarchy(document: LangiumDocument<AstNode>, params: CallHierarchyPrepareParams): CallHierarchyItem[] | null {
        const rootNode = document.parseResult.value;
        const targetNode = findDeclarationNodeAtOffset(rootNode.$cstNode, document.textDocument.offsetAt(params.position), this.grammarConfig.nameRegexp);
        if (!targetNode) {
            return null;
        }

        const declarationNode = this.references.findDeclaration(targetNode);
        if (!declarationNode) {
            return null;
        }

        return this.getCallHierarchyItems(declarationNode?.element, document);
    }

    protected getCallHierarchyItems(targetNode: AstNode, document: LangiumDocument<AstNode>): CallHierarchyItem[] {
        const nameNode = this.nameProvider.getNameNode(targetNode);
        if (!nameNode) {
            return [];
        }

        return [{
            kind: SymbolKind.Method,
            name: nameNode.text,
            range: nameNode.range,
            selectionRange: nameNode.range,
            uri: document.uri.toString()
        }];
    }

    incomingCalls(params: CallHierarchyIncomingCallsParams): CallHierarchyIncomingCall[] | null {
        const document = this.documents.getOrCreateDocument(URI.parse(params.item.uri));
        const rootNode = document.parseResult.value;
        const targetNode = findDeclarationNodeAtOffset(rootNode.$cstNode, document.textDocument.offsetAt(params.item.range.start), this.grammarConfig.nameRegexp);
        if (!targetNode) {
            return null;
        }

        const references = this.references.findReferences(targetNode.element, {includeDeclaration: false, onlyLocal: false}).toArray();
        return this.getIncomingCalls(references);
    }

    /**
     * Override this method to collect the incoming calls for your language
     */
    protected getIncomingCalls(_references: ReferenceDescription[]): CallHierarchyIncomingCall[] | null {
        return null;
    }

    outgoingCalls(params: CallHierarchyOutgoingCallsParams): CallHierarchyOutgoingCall[] | null {
        const document = this.documents.getOrCreateDocument(URI.parse(params.item.uri));
        const rootNode = document.parseResult.value;
        const targetNode = findDeclarationNodeAtOffset(rootNode.$cstNode, document.textDocument.offsetAt(params.item.range.start), this.grammarConfig.nameRegexp);
        if (!targetNode) {
            return null;
        }
        return this.getOutgoingCalls(targetNode.element);
    }

    /**
     * Override this method to collect the outgoing calls for your language
     */
    protected getOutgoingCalls(_node: AstNode): CallHierarchyOutgoingCall[] | null {
        return null;
    }
}
