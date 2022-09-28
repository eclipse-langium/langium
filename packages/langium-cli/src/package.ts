/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import type { IParserConfig } from 'langium';
import path from 'path';
import type { GenerateOptions } from './generate';
import { log } from './generator/util';
import chalk from 'chalk';

export interface Package {
    name: string
    version: string
    langium: LangiumConfig
}

export const RelativePath = Symbol('RelativePath');

export interface LangiumConfig {
    /** Relative path to the directory of the config */
    [RelativePath]: string
    /** Name of the language project */
    projectName: string
    /** Array of language configurations */
    languages: LangiumLanguageConfig[]
    /** Main output directory for TypeScript code */
    out?: string
    /** Configure the chevrotain parser for all languages */
    chevrotainParserConfig?: IParserConfig,
    /** The following option is meant to be used only by Langium itself */
    langiumInternal?: boolean
}

export interface LangiumLanguageConfig {
    /** The identifier of your language as used in vscode */
    id: string
    /** Path to the grammar file */
    grammar: string
    /** File extensions with leading `.` */
    fileExtensions?: string[]
    /** Enable case-insensitive keywords parsing */
    caseInsensitive?: boolean
    /** Enable generating a TextMate syntax highlighting file */
    textMate?: {
        /** Output path to syntax highlighting file */
        out: string
    }
    /** Enable generating a Monarch syntax highlighting file */
    monarch?: {
        /** Output path to syntax highlighting file */
        out: string
    }
    /** Configure the chevrotain parser for a single language */
    chevrotainParserConfig?: IParserConfig
}

export function getFilePath(absPath: string, config: LangiumConfig): string {
    const base = config[RelativePath] ?? process.cwd();
    return path.relative(base, absPath);
}

export async function loadConfigs(options: GenerateOptions): Promise<LangiumConfig[]> {
    let filePath: string;
    if (options.file) {
        filePath = path.normalize(options.file);
    } else {
        let defaultFile = 'langium-config.json';
        if (!fs.existsSync(defaultFile)) {
            defaultFile = 'package.json';
        }
        filePath = path.normalize(defaultFile);
    }
    const relativePath = path.dirname(filePath);
    log('log', options, `Reading config from ${chalk.white.bold(filePath)}`);
    try {
        const obj = await fs.readJson(filePath, { encoding: 'utf-8' });
        const config: LangiumConfig | LangiumConfig[] = path.basename(filePath) === 'package.json' ? obj.langium : obj;
        if (Array.isArray(config)) {
            config.forEach(c => {
                c[RelativePath] = relativePath;
            });
            return config;
        } else {
            config[RelativePath] = relativePath;
        }
        return [config];
    } catch (err) {
        log('error', options, chalk.red('Failed to read config file.'), err);
        process.exit(1);
    }
}
