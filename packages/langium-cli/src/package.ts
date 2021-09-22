/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import path from 'path';
import { getTime } from './generator/util';

export interface Package {
    name: string,
    version: string,
    langium: LangiumConfig
}

export const RelativePath = Symbol('RelativePath');

export interface LangiumConfig {
    /** Relative path to the directory of the config */
    [RelativePath]: string
    /** The identifier of your language as used in vscode */
    languageId: string
    /** Path to the grammar file */
    grammar: string
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
    const filePath = path.normalize(file ?? defaultPath);
    const relativePath = path.dirname(filePath);
    console.log(`${getTime()}Reading config from ${filePath.white.bold}`);
    let obj;
    try {
        obj = fs.readJsonSync(filePath, { encoding: 'utf-8' });
    } catch (e) {
        console.error(getTime() + 'Failed to read config file.', e);
        process.exit(1);
    }
    if (Array.isArray(obj)) { // We have an array of configs in our 'langium-config.json'
        return obj.map(e => {
            e[RelativePath] = relativePath;
            return e;
        });
    } else if (!('name' in obj)) { // We have a single config in our 'langium-config.json'
        obj[RelativePath] = relativePath;
        return [obj];
    } else { // Invalid data
        return [];
    }
}
