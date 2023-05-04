/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CallHierarchyIncomingCall, CallHierarchyIncomingCallsParams, CallHierarchyItem, CallHierarchyOutgoingCall, CallHierarchyOutgoingCallsParams, CallHierarchyPrepareParams, CancellationToken } from 'vscode-languageserver';
import type { GrammarConfig } from '../grammar/grammar-config';
import type { NameProvider } from '../references/name-provider';
import type { References } from '../references/references';
import type { LangiumServices } from '../services';
import type { AstNode } from '../syntax-tree';
import type { Stream } from '../utils/stream';
import type { ReferenceDescription } from '../workspace/ast-descriptions';
import type { LangiumDocument, LangiumDocuments } from '../workspace/documents';
import { SymbolKind } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { findDeclarationNodeAtOffset } from '../utils/cst-util';

/**
 * Language-specific service for handling call hierarchy requests.
 */
export interface CallHierarchyProvider {
    prepareCallHierarchy(document: LangiumDocument, params: CallHierarchyPrepareParams, cancelToken?: CancellationToken): CallHierarchyItem[] | undefined;

    incomingCalls(params: CallHierarchyIncomingCallsParams, cancelToken?: CancellationToken): CallHierarchyIncomingCall[] | undefined;

    outgoingCalls(params: CallHierarchyOutgoingCallsParams, cancelToken?: CancellationToken): CallHierarchyOutgoingCall[] | undefined;
}

export abstract class AbstractCallHierarchyProvider implements CallHierarchyProvider {
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

    prepareCallHierarchy(document: LangiumDocument<AstNode>, params: CallHierarchyPrepareParams): CallHierarchyItem[] | undefined {
        const rootNode = document.parseResult.value;
        const targetNode = findDeclarationNodeAtOffset(
            rootNode.$cstNode,
            document.textDocument.offsetAt(params.position),
            this.grammarConfig.nameRegexp
        );
        if (!targetNode) {
            return undefined;
        }

        const declarationNode = this.references.findDeclarationNode(targetNode);
        if (!declarationNode) {
            return undefined;
        }

        return this.getCallHierarchyItems(declarationNode.element, document);
    }

    protected getCallHierarchyItems(targetNode: AstNode, document: LangiumDocument<AstNode>): CallHierarchyItem[] | undefined {
        const nameNode = this.nameProvider.getNameNode(targetNode);
        const name = this.nameProvider.getName(targetNode);
        if (!nameNode || !targetNode.$cstNode || name === undefined) {
            return undefined;
        }

        return [{
            kind: SymbolKind.Method,
            name,
            range: targetNode.$cstNode.range,
            selectionRange: nameNode.range,
            uri: document.uri.toString(),
            ...this.getCallHierarchyItem(targetNode)
        }];
    }

    protected getCallHierarchyItem(_targetNode: AstNode): Partial<CallHierarchyItem> | undefined {
        return undefined;
    }

    incomingCalls(params: CallHierarchyIncomingCallsParams): CallHierarchyIncomingCall[] | undefined {
        const document = this.documents.getOrCreateDocument(URI.parse(params.item.uri));
        const rootNode = document.parseResult.value;
        const targetNode = findDeclarationNodeAtOffset(
            rootNode.$cstNode,
            document.textDocument.offsetAt(params.item.range.start),
            this.grammarConfig.nameRegexp
        );
        if (!targetNode) {
            return undefined;
        }

        const references = this.references.findReferences(
            targetNode.element,
            {
                includeDeclaration: false
            }
        );
        return this.getIncomingCalls(targetNode.element, references);
    }

    /**
     * Override this method to collect the incoming calls for your language
     */
    protected abstract getIncomingCalls(node: AstNode, references: Stream<ReferenceDescription>): CallHierarchyIncomingCall[] | undefined;

    outgoingCalls(params: CallHierarchyOutgoingCallsParams): CallHierarchyOutgoingCall[] | undefined {
        const document = this.documents.getOrCreateDocument(URI.parse(params.item.uri));
        const rootNode = document.parseResult.value;
        const targetNode = findDeclarationNodeAtOffset(
            rootNode.$cstNode,
            document.textDocument.offsetAt(params.item.range.start),
            this.grammarConfig.nameRegexp
        );
        if (!targetNode) {
            return undefined;
        }
        return this.getOutgoingCalls(targetNode.element);
    }

    /**
     * Override this method to collect the outgoing calls for your language
     */
    protected abstract getOutgoingCalls(node: AstNode): CallHierarchyOutgoingCall[] | undefined;
}
