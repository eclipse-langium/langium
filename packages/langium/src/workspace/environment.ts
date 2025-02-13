/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { InitializeParams, InitializedParams } from 'vscode-languageserver-protocol';

export interface EnvironmentInfo {
    readonly isLanguageServer: boolean;
    readonly locale: string;
}

export interface Environment extends EnvironmentInfo {
    initialize(params: InitializeParams): void;
    initialized(params: InitializedParams): void;
    update(newEnvironment: Partial<EnvironmentInfo>): void;
}

export class DefaultEnvironment implements Environment {

    private _isLanguageServer: boolean = false;
    private _locale: string = 'en';

    get isLanguageServer(): boolean {
        return this._isLanguageServer;
    }

    get locale(): string {
        return this._locale;
    }

    initialize(params: InitializeParams): void {
        this.update({
            isLanguageServer: true,
            locale: params.locale
        });
    }

    initialized(_params: InitializedParams): void {
    }

    update(newEnvironment: Partial<EnvironmentInfo>): void {
        if (typeof newEnvironment.isLanguageServer === 'boolean') {
            this._isLanguageServer = newEnvironment.isLanguageServer;
        }
        if (typeof newEnvironment.locale === 'string') {
            this._locale = newEnvironment.locale;
        }
    }
}
