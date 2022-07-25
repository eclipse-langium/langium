/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Connection, DidChangeConfigurationParams } from 'vscode-languageserver';
import { ConfigurationItem, DidChangeConfigurationNotification } from 'vscode-languageserver-protocol';
import { ServiceRegistry } from '../service-registry';
import { LangiumSharedServices } from '../services';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ConfigurationProvider {
    /**
    * Returns a configuration value stored for the given language.
    *
    * @param language The language id
    * @param configuration Configuration name
    */
    getConfiguration(language: string, configuration: string): Promise<any>;

    /**
     *  Updates the cached configurations using the `change` notification parameters.
     *
     * @param change The parameters of a change configuration notification.
     * `settings` property of the change object could be expressed as `Record<string, Record<string, any>>`
     */
    updateConfiguration(change: DidChangeConfigurationParams): void;
}

export class DefaultConfigurationProvider implements ConfigurationProvider {

    protected settings: Record<string, Record<string, any>> = {};
    protected workspaceConfig = false;
    protected initialized = false;
    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly connection: Connection | undefined;

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
        this.connection = services.lsp.Connection;
        services.lsp.LanguageServer.onInitialize(params => {
            this.workspaceConfig = params.capabilities.workspace?.configuration ?? false;
        });
        services.lsp.LanguageServer.onInitialized(_params => {
            const languages = this.serviceRegistry.all;
            services.lsp.Connection?.client.register(DidChangeConfigurationNotification.type, {
                // Listen to configuration changes for all languages
                section: languages.map(lang => this.toSectionName(lang.LanguageMetaData.languageId))
            });
        });
    }

    protected async initialize(): Promise<void> {
        if (this.workspaceConfig && this.connection) {
            const languages = this.serviceRegistry.all;
            const configToUpdate: ConfigurationItem[] = languages.map(lang => { return { section: this.toSectionName(lang.LanguageMetaData.languageId) }; });
            // get workspace configurations (default scope URI)
            const configs = await this.connection.workspace.getConfiguration(configToUpdate);
            configToUpdate.forEach((conf, idx) => {
                this.updateSectionConfiguration(conf.section!, configs[idx]);
            });
        }
        this.initialized = true;
    }

    updateConfiguration(change: DidChangeConfigurationParams): void {
        if(!change.settings) {
            return;
        }
        Object.keys(change.settings).forEach(section => {
            this.updateSectionConfiguration(section, change.settings[section]);
        });
    }

    protected updateSectionConfiguration(section: string, configuration: any): void {
        this.settings[section] = configuration;
    }

    async getConfiguration(language: string, configuration: string): Promise<any> {
        if (!this.initialized) {
            await this.initialize();
        }
        const sectionName = this.toSectionName(language);
        if (this.settings[sectionName]) {
            return this.settings[sectionName][configuration];
        }
    }

    protected toSectionName(languageId: string): string {
        return `${languageId}`;
    }
}

