/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices, LangiumSharedServices, PartialLangiumSharedServices, startLanguageServer } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { LangiumGrammarWorkspaceManager } from './grammar-workspace-manager';
import { Module } from 'djinject';

const connection = createConnection(ProposedFeatures.all);

export const LangiumGrammarSharedModule: Module<LangiumSharedServices, PartialLangiumSharedServices> = {
    workspace: {
        WorkspaceManager: (services: LangiumSharedServices) => new LangiumGrammarWorkspaceManager(services)
    }
};
const { shared } = createLangiumGrammarServices({ connection, ...NodeFileSystem }, LangiumGrammarSharedModule);
startLanguageServer(shared);
