/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ConfigurationItem, DidChangeConfigurationParams, DidChangeConfigurationRegistrationOptions, InitializeParams, InitializedParams } from 'vscode-languageserver-protocol';
import type { ServiceRegistry } from '../service-registry.js';
import type { LangiumSharedCoreServices } from '../services.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ConfigurationProvider {

    /**
     * When used in a language server context, this method is called when the server receives
     * the `initialize` request.
     */
    initialize(params: InitializeParams): void;

    /**
     * When used in a language server context, this method is called when the server receives
     * the `initialized` notification.
     */
    initialized(params: ConfigurationInitializedParams): Promise<void>;

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
    fetchConfiguration?: (configuration: ConfigurationItem[]) => Promise<any>
}

/**
 * Base configuration provider for building up other configuration providers
 */
export class DefaultConfigurationProvider implements ConfigurationProvider {

    protected readonly serviceRegistry: ServiceRegistry;
    protected settings: Record<string, Record<string, any>> = {};
    protected workspaceConfig = false;
    protected fetchConfiguration: ((configurations: ConfigurationItem[]) => Promise<any>) | undefined;

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

            // params.fetchConfiguration(...) is a function to be provided by the calling language server for the sake of
            //  decoupling this implementation from the concrete LSP implementations, specifically the LSP Connection
            this.fetchConfiguration = params.fetchConfiguration;

            // awaiting the fetch of the initial configuration data must not happen here, because it would block the
            //  initialization of the language server, and may lead to out-of-order processing of subsequent messages from the language client;
            // fetching the initial configuration in a non-blocking manner might cause a read-before-write problem
            //  in case the workspace initialization relies on that configuration data (which is the case for the grammar language server);
            // consequently, we fetch the initial configuration data on blocking manner on-demand, when the first configuration value is read,
            //  see below in #getConfiguration(...);
        }
    }

    protected async initializeConfiguration(): Promise<void> {
        if (this.fetchConfiguration) {
            const configToUpdate = this.serviceRegistry.all.map(lang => <ConfigurationItem>{
                // Fetch the configuration changes for all languages
                section: this.toSectionName(lang.LanguageMetaData.languageId)
            });

            // get workspace configurations (default scope URI)
            const configs = await this.fetchConfiguration(configToUpdate);
            configToUpdate.forEach((conf, idx) => {
                this.updateSectionConfiguration(conf.section!, configs[idx]);
            });

            // reset the 'fetchConfiguration' to 'undefined' again in order to prevent further 'fetch' attempts
            this.fetchConfiguration = undefined;
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
        await this.initializeConfiguration();

        const sectionName = this.toSectionName(language);
        if (this.settings[sectionName]) {
            return this.settings[sectionName][configuration];
        }
    }

    protected toSectionName(languageId: string): string {
        return `${languageId}`;
    }
}
