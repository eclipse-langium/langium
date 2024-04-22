/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { GenerateOptions } from './generate.js';
import { log } from './generator/langium-util.js';
import chalk from 'chalk';
import fs from 'fs-extra';
import { EOL } from 'os';
import * as path from 'path';
import type { LangiumConfig} from './package-types.js';
import { RelativePath } from './package-types.js';

export function getFilePath(absPath: string, config: LangiumConfig): string {
    const base = config[RelativePath] ?? process.cwd();
    return path.relative(base, absPath);
}

export async function loadConfig(options: GenerateOptions): Promise<LangiumConfig> {
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
    if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(process.cwd(), filePath);
    }
    log('log', options, `Reading config from ${chalk.white.bold(filePath)}`);
    try {
        const obj = await fs.readJson(filePath, { encoding: 'utf-8' });
        const config: LangiumConfig | undefined = path.basename(filePath) === 'package.json' ? obj.langium : obj;
        if (!config) {
            throw new Error('Langium config is missing.');
        }
        config[RelativePath] = relativePath;
        config.importExtension ??= '.js';
        return config;
    } catch (err) {
        const suffix = options.file
            ? path.basename(filePath) === 'package.json' ? `an object named 'langium' in ${filePath}` : filePath
            : `${path.resolve(path.dirname(filePath), 'langium-config.json')} or an object named 'langium' in ${path.resolve(path.dirname(filePath), 'package.json')}`;
        log('error', options, chalk.red(`Failed to read Langium config: Could not find ${suffix}.${EOL}`), err);
        process.exit(1);
    }
}
