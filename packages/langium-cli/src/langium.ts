/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Command } from 'commander';
import { generate, GenerateOptions } from './generate';

const program = new Command();
program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../package.json').version);

program
    .command('generate')
    .description('Generate code for a Langium language')
    .option('-f', '--file <file>')
    .action((options: GenerateOptions) => {
        generate(options);
    });

program.parse(process.argv);
