/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { type Module } from 'langium';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createLangiumGrammarServices } from 'langium/grammar';
import { startLanguageServer, type LangiumSharedServices, type PartialLangiumSharedServices } from 'langium/lsp';
import { NodeFileSystem } from 'langium/node';
import { ProposedFeatures, createConnection } from 'vscode-languageserver/node';
import { LangiumGrammarWorkspaceManager } from './grammar-workspace-manager.js';
import { registerRailroadConnectionHandler } from './railroad-handler.js';
import { registerLangiumConfigHandler } from './config-handler.js';
import { DefaultMcpService } from 'langium-mcp';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createServer } from 'node:http';

const connection = createConnection(ProposedFeatures.all);

export const LangiumGrammarSharedModule: Module<LangiumSharedServices, PartialLangiumSharedServices> = {
    workspace: {
        WorkspaceManager: (services) => new LangiumGrammarWorkspaceManager(services)
    }
};

const { shared, grammar } = createLangiumGrammarServices({ connection, ...NodeFileSystem }, LangiumGrammarSharedModule);
registerLangiumConfigHandler(connection, shared, grammar);
registerRailroadConnectionHandler(connection, grammar);
startLanguageServer(shared);

const mcpService = new DefaultMcpService(shared, {
    name: 'Langium Grammar MCP Server',
    version: '4.3.0'
});

const handler = createMcpHandler(() => mcpService.createServer());
const nodeHandler = toNodeHandler(handler);
createServer((req, res) => {
    nodeHandler(req, res);
}).listen(8999, '127.0.0.1');
