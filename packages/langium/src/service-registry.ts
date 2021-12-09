/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI, Utils } from 'vscode-uri';
import { LangiumServices } from './services';

export interface ServiceRegistry {
    getService(uri: URI): LangiumServices
    readonly all: LangiumServices[]
}

export function createSingleServiceRegistry(services: LangiumServices): ServiceRegistry {
    return new DefaultServiceRegistry(services);
}

export class DefaultServiceRegistry implements ServiceRegistry {

    services: LangiumServices

    constructor(services?: LangiumServices) {
        this.services = services!;
    }

    getService(): LangiumServices {
        return this.services;
    }

    get all(): LangiumServices[] {
        return [this.services];
    }
}

export class ExtensionServiceRegistry implements ServiceRegistry {

    protected map: Record<string, LangiumServices> = {}

    add(ext: string, service: LangiumServices): void {
        this.map[ext] = service;
    }

    getService(uri: URI): LangiumServices {
        const ext = Utils.extname(uri);
        if (ext in this.map) {
            return this.map[ext];
        } else {
            throw new Error(`The service registry contains no service for extension '${ext}'.`);
        }
    }

    get all(): LangiumServices[] {
        return Object.values(this.map);
    }
}
