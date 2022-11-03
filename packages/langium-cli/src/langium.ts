/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import chalk from 'chalk';
import fs from 'fs-extra';
import { Command } from 'commander';
import { validate } from 'jsonschema';
import { ExtractTypesOptions, generate, GenerateOptions, generateTypes, GeneratorResult } from './generate';
import { cliVersion, elapsedTime, getTime, log, schema } from './generator/util';
import { LangiumConfig, loadConfigs, RelativePath } from './package';
import path from 'path';
import _ from 'lodash';

const program = new Command();
program
    .version(cliVersion)
    .command('generate')
    .description('Generate code for a Langium grammar')
    .option('-f, --file <file>', 'the configuration file or package.json setting up the generator')
    .option('-w, --watch', 'enables watch mode', false)
    .action((options: GenerateOptions) => {
        forEachConfig(options, generate).catch(err => {
            console.error(err);
            process.exit(1);
        });
    });
program.command('extract-types')
    .argument('<file>', 'the langium grammar file to generate types for')
    .option('-o, --output <file>', 'output file name. Default is types.langium next to the grammar file.')
    .option('-f, --force', 'Force overwrite existing file.')
    .action((file, options: ExtractTypesOptions) => {
        options.grammar = file;
        generateTypes(options).catch(err => {
            console.error(err);
            process.exit(1);
        });
    })
    .action;

program.parse(process.argv);

async function forEachConfig(options: GenerateOptions, callback: (config: LangiumConfig, options: GenerateOptions) => Promise<GeneratorResult>): Promise<void> {
    const configs = await loadConfigs(options);
    const validation = validate(configs, schema, {
        nestedErrors: true
    });
    if (!validation.valid) {
        log('error', options, chalk.red('Error: Your Langium configuration is invalid.'));
        const errors = validation.errors.filter(error => error.path.length > 0);
        errors.forEach(error => {
            log('error', options, `--> ${error.stack}`);
        });
        process.exit(1);
    }
    const results = await Promise.all(configs.map(config => {
        config.projectName = _.camelCase(config.projectName);
        config.projectName = config.projectName.charAt(0).toUpperCase() + config.projectName.slice(1);
        return callback(config, options);
    }));
    const allSuccessful = results.every(result => result === 'success');
    if (options.watch) {
        if (allSuccessful) {
            console.log(`${getTime()}Langium generator finished ${chalk.green.bold('successfully')} in ${elapsedTime()}ms`);
        }
        console.log(getTime() + 'Langium generator will continue running in watch mode');
        for (const config of configs) {
            for (const language of config.languages) {
                const grammarPath = path.resolve(config[RelativePath], language.grammar);
                fs.watchFile(grammarPath, async () => {
                    console.log(getTime() + 'File change detected. Starting compilation...');
                    elapsedTime();
                    if (await callback(config, options) === 'success') {
                        console.log(`${getTime()}Langium generator finished ${chalk.green.bold('successfully')} in ${elapsedTime()}ms`);
                    }
                });
            }
        }
    } else if (!allSuccessful) {
        process.exit(1);
    } else {
        console.log(`Langium generator finished ${chalk.green.bold('successfully')} in ${elapsedTime()}ms`);
    }
}
