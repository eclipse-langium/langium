/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Command, Option } from 'commander';
import type { ExtractTypesOptions, GenerateOptions} from './generate.js';
import { generate, generateTypes } from './generate.js';
import { cliVersion } from './generator/util.js';

const program = new Command();

program
    .version(cliVersion)
    .command('generate')
    .description('Generate code for a Langium grammar')
    .option('-f, --file <file>', 'the configuration file or package.json setting up the generator')
    .option('-w, --watch', 'enables watch mode', false)
    .addOption(new Option('-m, --mode <mode>', 'used mode for optimized builds for your current environment').choices(['development', 'production']))
    .action((options: GenerateOptions) => {
        generate(options).catch(err => {
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
