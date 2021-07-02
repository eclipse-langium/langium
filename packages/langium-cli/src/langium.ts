/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import 'colors';
import { Command } from 'commander';
import { validate } from 'jsonschema';
import { generate, GenerateOptions } from './generate';
import { cliVersion, elapsedTime, schema } from './generator/util';
import { LangiumConfig, loadConfigs } from './package';

const program = new Command();
program
    .version(cliVersion)
    .command('generate')
    .description('Generate code for a Langium grammar')
    .option('-f, --file <file>', 'the configuration file or package.json setting up the generator')
    .action((options: GenerateOptions) => {
        forEachConfig(options, generate);
        console.log(`Langium generator finished ${'successfully'.green.bold} in: ${elapsedTime()}ms`);
    });

program.parse(process.argv);

function forEachConfig(options: GenerateOptions, callback: (config: LangiumConfig) => void): void {
    const configs = loadConfigs(options.file);
    if (!configs.length) {
        console.error('Could not find a langium configuration. Please add a langium-config.json to your project or a langium section to your package.json.'.red);
        process.exit(1);
    }
    const validation = validate(configs, schema);
    if (!validation.valid) {
        console.error('Your langium configuration is invalid.'.red);
        process.exit(1);
    }
    configs.forEach(callback);
}
