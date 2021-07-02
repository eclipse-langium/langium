/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import path from 'path';

export interface Package {
    name: string,
    version: string,
    langium: LangiumConfig
}

export const AbsolutePath = Symbol('AbsolutePath');

export interface LangiumConfig {
    /** Absolute path to the directory of the config */
    [AbsolutePath]: string
    /** The identifier of your language as used in vscode */
    languageId?: string
    /** Path to the grammar file */
    grammar?: string
    /** File extensions with leading `.` */
    fileExtensions?: string[]
    /** Main output directory for TypeScript code */
    out?: string
    /** Enable generating a TextMate syntax highlighting file */
    textMate?: {
        /** Output path to syntax highlighting file */
        out: string
    }
    /** The following option is meant to be used only by Langium itself */
    langiumInternal?: boolean
}

export function loadConfigs(file: string | undefined): LangiumConfig[] {
    let defaultPath = './langium-config.json';
    if (!fs.existsSync(defaultPath)) {
        defaultPath = './package.json';
    }
    const filePath = file ?? defaultPath;
    const fullPath = path.join(process.cwd(), path.dirname(filePath));
    const obj = fs.readJsonSync(filePath, { encoding: 'utf-8' });
    if (Array.isArray(obj)) { // We have an array of configs in our 'langium-config.json'
        return obj.map(e => {
            e[AbsolutePath] = fullPath;
            return e;
        });
    } else if ('langium' in obj) { // We use a 'package.json' as our config file
        obj.langium[AbsolutePath] = fullPath;
        return [obj.langium];
    } else if (!('name' in obj)) { // We have a single config in our 'langium-config.json'
        obj[AbsolutePath] = fullPath;
        return [obj];
    } else { // Invalid data
        return [];
    }
}
