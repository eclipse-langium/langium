/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, DocumentSymbol, DocumentSymbolParams, SymbolKind } from 'vscode-languageserver';
import { NameProvider } from '../references/name-provider';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { streamContents } from '../utils/ast-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling document symbols requests.
 */
export interface DocumentSymbolProvider {
    /**
     * Handle a document symbols request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    getSymbols(document: LangiumDocument, params: DocumentSymbolParams, cancelToken?: CancellationToken): MaybePromise<DocumentSymbol[]>;
}

export class DefaultDocumentSymbolProvider implements DocumentSymbolProvider {

    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    getSymbols(document: LangiumDocument): MaybePromise<DocumentSymbol[]> {
        return this.getSymbol(document, document.parseResult.value);
    }

    protected getSymbol(document: LangiumDocument, astNode: AstNode): DocumentSymbol[] {
        const node = astNode.$cstNode;
        const nameNode = this.nameProvider.getNameNode(astNode);
        if (nameNode && node) {
            const name = this.nameProvider.getName(astNode);
            return [{
                kind: this.getSymbolKind(astNode.$type),
                name: name ?? nameNode.text,
                range: node.range,
                selectionRange: nameNode.range,
                children: this.getChildSymbols(document, astNode)
            }];
        } else {
            return this.getChildSymbols(document, astNode) || [];
        }
    }

    protected getChildSymbols(document: LangiumDocument, astNode: AstNode): DocumentSymbol[] | undefined {
        const children: DocumentSymbol[] = [];

        for (const child of streamContents(astNode)) {
            const result = this.getSymbol(document, child);
            children.push(...result);
        }
        if (children.length > 0) {
            return children;
        }
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected getSymbolKind(type: string): SymbolKind {
        return SymbolKind.Field;
    }
}
