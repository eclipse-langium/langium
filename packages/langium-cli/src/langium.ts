/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import 'colors';
import fs from 'fs-extra';
import { Command } from 'commander';
import { validate } from 'jsonschema';
import { generate, GenerateOptions, GeneratorResult } from './generate';
import { cliVersion, elapsedTime, getTime, schema } from './generator/util';
import { LangiumConfig, loadConfigs, RelativePath } from './package';
import path from 'path';

const program = new Command();
program
    .version(cliVersion)
    .command('generate')
    .description('Generate code for a Langium grammar')
    .option('-f, --file <file>', 'the configuration file or package.json setting up the generator')
    .option('-w, --watch', 'enables watch mode', false)
    .action((options: GenerateOptions) => {
        forEachConfig(options, generate);
    });

program.parse(process.argv);

async function forEachConfig(options: GenerateOptions, callback: (config: LangiumConfig) => Promise<GeneratorResult>): Promise<void> {
    const configs = loadConfigs(options.file);
    const validation = validate(configs, schema, {
        nestedErrors: true
    });
    if (!validation.valid) {
        console.error('Error: Your Langium configuration is invalid.'.red);
        const errors = validation.errors.filter(error => error.path.length > 0);
        errors.forEach(error => {
            console.error(`--> ${error.stack}`);
        });
        process.exit(1);
    }
    const allSuccessful = await callback(configs) === 'success';
    if (options.watch) {
        if (allSuccessful) {
            console.log(`${getTime()}Langium generator finished ${'successfully'.green.bold} in ${elapsedTime()}ms`);
        }
        console.log(getTime() + 'Langium generator will continue running in watch mode');
        configs.languages.forEach(e => {
            const grammarPath = path.resolve(configs[RelativePath], e.grammar);
            fs.watchFile(grammarPath, async () => {
                console.log(getTime() + 'File change detected. Starting compilation...');
                elapsedTime();
                if (await callback(configs) === 'success') {
                    console.log(`${getTime()}Langium generator finished ${'successfully'.green.bold} in ${elapsedTime()}ms`);
                }
            });
        });
    } else if (!allSuccessful) {
        process.exit(1);
    } else {
        console.log(`${getTime()}Langium generator finished ${'successfully'.green.bold} in ${elapsedTime()}ms`);
    }
}
