/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'node:fs/promises';
import path from 'node:path';
import { URI } from 'vscode-uri';
import type { LangiumGrammarServices } from 'langium/grammar';
import type { LangiumSharedServices } from 'langium/lsp';
import type { Connection, WorkspaceFolder } from 'vscode-languageserver';

export function registerLangiumConfigHandler(connection: Connection, shared: LangiumSharedServices, grammar: LangiumGrammarServices) {
    async function tryConfig(filePath: string) {
        try {
            const json = await fs.readFile(filePath, { encoding: 'utf-8' });
            let config = JSON.parse(json);
            if (path.basename(filePath) === 'package.json') {
                config = config.langium;
            }
            if (typeof config === 'object' && config !== null) {
                // Langium config found, apply validation options
                grammar.validation.LangiumGrammarValidator.options = config.validation ?? {};
                return config;
            }
            return undefined;
        } catch (_error) {
            return undefined;
        }
    }

    let workspaceFolders: WorkspaceFolder[] | undefined;
    shared.lsp.LanguageServer.onInitialize((params) => {
        workspaceFolders = params.workspaceFolders ?? undefined;
    });

    async function updateConfig(configPath: string): Promise<string | undefined> {
        if (typeof configPath !== 'string') {
            return;
        }
        if (path.isAbsolute(configPath)) {
            const normalized = path.normalize(configPath);
            const result = await tryConfig(normalized);
            if (result) {
                return normalized;
            }
        }
        // Try to find a configuration file in workspace folders
        for (const folder of workspaceFolders ?? []) {
            const filePath = path.join(URI.parse(folder.uri).fsPath, configPath);
            const result = await tryConfig(filePath);
            if (result) {
                return filePath;
            }
        }
        return undefined;
    }

    let configPath: string | undefined;
    async function configChanged(newConfigPath: string) {
        const resolved = await updateConfig(newConfigPath);
        if (!resolved) {
            // No configuration file found, use default validation options
            grammar.validation.LangiumGrammarValidator.options = {};
        }
        try {
            // Wait until the workspace is ready
            await shared.workspace.WorkspaceManager.ready;
        } catch {
            // Workspace initialization failed, cannot proceed
            return;
        }
        configPath = resolved;

        // Revalidate all documents
        const documents = shared.workspace.LangiumDocuments;
        const documentBuilder = shared.workspace.DocumentBuilder;
        const mutex = shared.workspace.WorkspaceLock;
        await mutex.write(async token => {
            await documentBuilder.build(documents.all.toArray(), { validation: true }, token);
        });
    }

    // Load validation options from configuration
    shared.lsp.LanguageServer.onInitialized(async () => {
        const setting = (await shared.workspace.ConfigurationProvider.getConfiguration('langium', 'config')) || 'langium-config.json';
        configPath = await updateConfig(setting);
    });

    // Update validation options when configuration changes
    shared.workspace.ConfigurationProvider.onConfigurationSectionUpdate(async update => {
        if (update.section === 'langium' && typeof update.configuration === 'object' && update.configuration !== null) {
            const newConfigPath = update.configuration.config || 'langium-config.json';
            if (newConfigPath !== configPath) {
                await configChanged(newConfigPath);
            }
        }
    });

    // Update validation options when the config file is changed
    shared.lsp.DocumentUpdateHandler.onWatchedFilesChange(params => {
        if (!configPath) {
            return;
        }
        for (const change of params.changes) {
            const uri = URI.parse(change.uri);
            if (uri.fsPath === configPath) {
                configChanged(uri.fsPath).catch(err => console.error(err));
                return;
            }
        }
    });
}
