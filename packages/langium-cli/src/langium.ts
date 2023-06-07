/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { ExtractTypesOptions, GenerateOptions, GeneratorResult } from './generate';
import type { LangiumConfig } from './package';
import chalk from 'chalk';
import fs from 'fs-extra';
import { Command } from 'commander';
import { validate } from 'jsonschema';
import { generate, generateTypes } from './generate';
import { cliVersion, elapsedTime, getTime, log, schema } from './generator/util';
import { loadConfig } from './package';

const program = new Command();
program
    .version(cliVersion)
    .command('generate')
    .description('Generate code for a Langium grammar')
    .option('-f, --file <file>', 'the configuration file or package.json setting up the generator')
    .option('-w, --watch', 'enables watch mode', false)
    .option('-m, --mode <mode>', 'use `development` or `production` for optimized builds for your current environment')
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
    const config = await loadConfig(options);
    const validation = validate(config, await schema, {
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
    const result = await generate(config, options);
    const successful = result.success;
    if (options.watch) {
        printSuccess(result);
        console.log(getTime() + 'Langium generator will continue running in watch mode.');
        await runWatcher(config, options, await allGeneratorFiles(result));
    } else if (!successful) {
        process.exit(1);
    } else {
        console.log(`Langium generator finished ${chalk.green.bold('successfully')} in ${elapsedTime()}ms`);
    }
}

async function allGeneratorFiles(results: GeneratorResult): Promise<string[]> {
    const files = Array.from(new Set(results.files));
    const filesExist = await Promise.all(files.map(e => fs.exists(e)));
    return files.filter((_, i) => filesExist[i]);
}

async function runWatcher(config: LangiumConfig, options: GenerateOptions, files: string[]): Promise<void> {
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
        const results = await generate(config, options);
        for (const watcher of watchers) {
            watcher.close();
        }
        printSuccess(results);
        runWatcher(config, options, await allGeneratorFiles(results));
    }
}

function printSuccess(results: GeneratorResult): void {
    if (results.success) {
        console.log(`${getTime()}Langium generator finished ${chalk.green.bold('successfully')} in ${elapsedTime()}ms`);
    }
}

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}
