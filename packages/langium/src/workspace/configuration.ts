/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ConfigurationItem, DidChangeConfigurationParams, DidChangeConfigurationRegistrationOptions } from 'vscode-languageserver-protocol';
import type { ServiceRegistry } from '../service-registry.js';
import type { InitializableService, InitializeParams, InitializedParams, LangiumSharedCoreServices } from '../services.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ConfigurationProvider extends InitializableService {
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

export interface ConfigurationInitializedParams extends InitializedParams {
    register?: (params: DidChangeConfigurationRegistrationOptions) => void,
    getConfiguration?: (configuration: ConfigurationItem[]) => Promise<any>
}

/**
 * Base configuration provider for building up other configuration providers
 */
export class DefaultConfigurationProvider implements ConfigurationProvider {

    protected readonly serviceRegistry: ServiceRegistry;
    protected settings: Record<string, Record<string, any>> = {};
    protected workspaceConfig = false;

    constructor(services: LangiumSharedCoreServices) {
        this.serviceRegistry = services.ServiceRegistry;
    }

    initialize(params: InitializeParams): void {
        this.workspaceConfig = params.capabilities.workspace?.configuration ?? false;
    }

    async initialized(params: ConfigurationInitializedParams): Promise<void> {
        if (this.workspaceConfig) {
            if (params.register) {
                // params.register(...) is a function to be provided by the calling language server for the sake of
                //  decoupling this implementation from the concrete LSP implementations, specifically the LSP Connection

                const languages = this.serviceRegistry.all;
                params.register({
                    // Listen to configuration changes for all languages
                    section: languages.map(lang => this.toSectionName(lang.LanguageMetaData.languageId))
                });
            }

            if (params.getConfiguration) {
                // params.getConfiguration(...) is a function to be provided by the calling language server for the sake of
                //  decoupling this implementation from the concrete LSP implementations, specifically the LSP Connection

                const configToUpdate = this.serviceRegistry.all.map(lang => <ConfigurationItem>{
                    // Fetch the configuration changes for all languages
                    section: this.toSectionName(lang.LanguageMetaData.languageId)
                });
                // get workspace configurations (default scope URI)
                const configs = await params.getConfiguration(configToUpdate);
                configToUpdate.forEach((conf, idx) => {
                    this.updateSectionConfiguration(conf.section!, configs[idx]);
                });
            }
        }
    }

    /**
     *  Updates the cached configurations using the `change` notification parameters.
     *
     * @param change The parameters of a change configuration notification.
     * `settings` property of the change object could be expressed as `Record<string, Record<string, any>>`
     */
    updateConfiguration(change: DidChangeConfigurationParams): void {
        if (!change.settings) {
            return;
        }
        Object.keys(change.settings).forEach(section => {
            this.updateSectionConfiguration(section, change.settings[section]);
        });
    }

    protected updateSectionConfiguration(section: string, configuration: any): void {
        this.settings[section] = configuration;
    }

    /**
    * Returns a configuration value stored for the given language.
    *
    * @param language The language id
    * @param configuration Configuration name
    */
    async getConfiguration(language: string, configuration: string): Promise<any> {
        const sectionName = this.toSectionName(language);
        if (this.settings[sectionName]) {
            return this.settings[sectionName][configuration];
        }
    }

    protected toSectionName(languageId: string): string {
        return `${languageId}`;
    }
}
