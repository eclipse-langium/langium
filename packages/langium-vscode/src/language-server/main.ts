/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumSharedServices, Module, PartialLangiumSharedServices } from 'langium';
import { createLangiumGrammarServices, startLanguageServer } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { LangiumGrammarWorkspaceManager } from './grammar-workspace-manager';
import { registerRailroadHandler } from './railroad-handler';

const connection = createConnection(ProposedFeatures.all);

export const LangiumGrammarSharedModule: Module<LangiumSharedServices, PartialLangiumSharedServices> = {
    workspace: {
        WorkspaceManager: (services) => new LangiumGrammarWorkspaceManager(services)
    }
};

const { shared, grammar } = createLangiumGrammarServices({ connection, ...NodeFileSystem }, LangiumGrammarSharedModule);
registerRailroadHandler(connection, grammar);
startLanguageServer(shared);
