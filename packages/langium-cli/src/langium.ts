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
import { LangiumConfig, loadConfigs } from './package';

const program = new Command();
program
    .version(cliVersion)
    .command('generate')
    .description('Generate code for a Langium grammar')
    .option('-f, --file <file>', 'the configuration file or package.json setting up the generator')
    .option('-w, --watch', 'enables watch mode', false)
    .action((options: GenerateOptions) => {
        runGenerator(options).catch(err => {
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
    });

program.parse(process.argv);

async function runGenerator(options: GenerateOptions): Promise<void> {
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
    const results = await Promise.all(configs.map(config => generate(config, options)));
    const allSuccessful = results.every(result => result.success);
    if (options.watch) {
        printSuccess(results);
        console.log(getTime() + 'Langium generator will continue running in watch mode.');
        await runWatcher(configs, options, await allGeneratorFiles(results));
    } else if (!allSuccessful) {
        process.exit(1);
    } else {
        console.log(`Langium generator finished ${chalk.green.bold('successfully')} in ${elapsedTime()}ms`);
    }
}

async function allGeneratorFiles(results: GeneratorResult[]): Promise<string[]> {
    const files = Array.from(new Set(results.flatMap(e => e.files)));
    const filesExist = await Promise.all(files.map(e => fs.exists(e)));
    return files.filter((_, i) => filesExist[i]);
}

async function runWatcher(configs: LangiumConfig[], options: GenerateOptions, files: string[]): Promise<void> {
    if (files.length === 0) {
        return;
    }
    const watchers: fs.FSWatcher[] = [];
    for (const grammarFile of files) {
        const watcher = fs.watch(grammarFile, undefined, watch);
        watchers.push(watcher);
    }
    // The watch might be triggered multiple times
    // We only want to execute once
    let watcherTriggered = false;

    async function watch(): Promise<void> {
        if (watcherTriggered) {
            return;
        }
        watcherTriggered = true;
        // Delay the generation a bit in case multiple files are changed at once
        await delay(20);
        console.log(getTime() + 'File change detected. Starting compilation...');
        const results = await Promise.all(configs.map(config => generate(config, options)));
        for (const watcher of watchers) {
            watcher.close();
        }
        printSuccess(results);
        runWatcher(configs, options, await allGeneratorFiles(results));
    }
}

function printSuccess(results: GeneratorResult[]): void {
    if (results.every(result => result.success)) {
        console.log(`${getTime()}Langium generator finished ${chalk.green.bold('successfully')} in ${elapsedTime()}ms`);
    }
}

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}