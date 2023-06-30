/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { WorkspaceSymbol, WorkspaceSymbolParams } from 'vscode-languageserver';
import type { LangiumSharedServices } from '../services';
import type { IndexManager } from '../workspace';
import type { MaybePromise} from '../utils/promise-util';
import type { AstNodeDescription } from '../syntax-tree';
import type { NodeKindProvider } from './node-kind-provider';
import { CancellationToken } from 'vscode-languageserver';
import { interruptAndCheck } from '../utils/promise-util';

export interface WorkspaceSymbolProvider {
    getSymbols(params: WorkspaceSymbolParams, cancelToken?: CancellationToken): MaybePromise<WorkspaceSymbol[]>;
    resolveSymbol?(symbol: WorkspaceSymbol, cancelToken?: CancellationToken): MaybePromise<WorkspaceSymbol>;
}

export class DefaultWorkspaceSymbolProvider implements WorkspaceSymbolProvider {

    protected readonly indexManager: IndexManager;
    protected readonly nodeKindProvider: NodeKindProvider;

    constructor(services: LangiumSharedServices) {
        this.indexManager = services.workspace.IndexManager;
        this.nodeKindProvider = services.lsp.NodeKindProvider;
    }

    async getSymbols(params: WorkspaceSymbolParams, cancelToken = CancellationToken.None): Promise<WorkspaceSymbol[]> {
        const workspaceSymbols: WorkspaceSymbol[] = [];
        const query = params.query.toLowerCase();
        for (const description of this.indexManager.allElements()) {
            await interruptAndCheck(cancelToken);
            if (description.name.toLowerCase().includes(query)) {
                const symbol = this.getWorkspaceSymbol(description);
                if (symbol) {
                    workspaceSymbols.push(symbol);
                }
            }
        }
        return workspaceSymbols;
    }

    protected getWorkspaceSymbol(astDescription: AstNodeDescription): WorkspaceSymbol | undefined {
        const nameSegment = astDescription.nameSegment;
        if (nameSegment) {
            return {
                kind: this.nodeKindProvider.getSymbolKind(astDescription),
                name: astDescription.name,
                location: {
                    range: nameSegment.range,
                    uri: astDescription.documentUri.toString()
                }
            };
        } else {
            return undefined;
        }
    }
}
