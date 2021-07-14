/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import colors from 'colors';
import { Command } from 'commander';
import { Statemachine } from '../language-server/generated/ast';
import { StatemachineLanguageMetaData } from '../language-server/generated/meta-data';
import { createStatemachineServices } from '../language-server/statemachine-module';
import { extractAstNode } from './cli-util';
import { StatemachineGenerator } from './generator';

const metaData = new StatemachineLanguageMetaData();

const program = new Command();

program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../../package.json').version);

program
    .command('generate')
    .argument('<file>', `possible file extensions: ${metaData.extensions.join(', ')}`)
    .option('-d, --destination <dir>', 'destination directory of generating')
    .description('generates a C++ CLI to walk over states')
    .action((fileName: string, opts: GenerateOptions) => {
        const statemachine = extractAstNode<Statemachine>(fileName, metaData.languageId, metaData.extensions, createStatemachineServices());
        const generatedFilePath = new StatemachineGenerator(statemachine, fileName, opts.destination).generate();
        console.log(colors.green('C++ code generated successfully:'), colors.yellow(generatedFilePath));
    });

program.parse(process.argv);

export type GenerateOptions = {
    destination?: string;
}