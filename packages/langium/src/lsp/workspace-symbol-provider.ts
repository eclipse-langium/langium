/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { DocumentSymbol, WorkspaceSymbol, WorkspaceSymbolParams } from 'vscode-languageserver';
import type { LangiumSharedServices } from '../services';
import type { ServiceRegistry } from '../service-registry';
import type { LangiumDocuments } from '../workspace';
import { CancellationToken, TextDocumentIdentifier } from 'vscode-languageserver';
import { interruptAndCheck, type MaybePromise } from '../utils/promise-util';

export interface WorkspaceSymbolProvider {
    getSymbols(params: WorkspaceSymbolParams, cancelToken?: CancellationToken): MaybePromise<WorkspaceSymbol[]>;
    resolveSymbol?(symbol: WorkspaceSymbol, cancelToken?: CancellationToken): MaybePromise<WorkspaceSymbol>;
}

export class DefaultWorkspaceSymbolProvider implements WorkspaceSymbolProvider {

    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly documents: LangiumDocuments;

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
        this.documents = services.workspace.LangiumDocuments;
    }

    async getSymbols(params: WorkspaceSymbolParams, cancelToken = CancellationToken.None): Promise<WorkspaceSymbol[]> {
        const workspaceSymbols: WorkspaceSymbol[] = [];
        const query = params.query.toLowerCase();
        for (const document of this.documents.all) {
            await interruptAndCheck(cancelToken);
            const languageServices = this.serviceRegistry.getServices(document.uri);
            const symbolProvider = languageServices.lsp.DocumentSymbolProvider;
            if (symbolProvider) {
                const uri = document.uri.toString();
                const symbols = await symbolProvider.getSymbols(document, {
                    textDocument: TextDocumentIdentifier.create(uri)
                }, cancelToken);
                for (const symbol of symbols) {
                    this.processDocumentSymbol(symbol, uri, query, workspaceSymbols);
                }
            }
        }
        return workspaceSymbols;
    }

    protected processDocumentSymbol(symbol: DocumentSymbol, uri: string, query: string, list: WorkspaceSymbol[]): void {
        if (!query || symbol.name.toLowerCase().startsWith(query)) {
            list.push({
                kind: symbol.kind,
                name: symbol.name,
                location: {
                    range: symbol.range,
                    uri
                }
            });
        }
        if (symbol.children && this.shouldProcessDocumentSymbolChildren(symbol)) {
            for (const child of symbol.children) {
                this.processDocumentSymbol(child, uri, query, list);
            }
        }
    }

    protected shouldProcessDocumentSymbolChildren(_symbol: DocumentSymbol): boolean {
        return true;
    }
}