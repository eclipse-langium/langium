/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import colors from 'colors';
import { Command } from 'commander';
import { Statemachine } from '../language-server/generated/ast';
import { languageMetaData } from '../language-server/generated/module';
import { createStatemachineServices } from '../language-server/statemachine-module';
import { extractAstNode } from './cli-util';
import { generateCpp } from './generator';

const program = new Command();

program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../../package.json').version);

program
    .command('generate')
    .argument('<file>', `possible file extensions: ${languageMetaData.fileExtensions.join(', ')}`)
    .option('-d, --destination <dir>', 'destination directory of generating')
    .description('generates a C++ CLI to walk over states')
    .action((fileName: string, opts: GenerateOptions) => {
        const statemachine = extractAstNode<Statemachine>(fileName, languageMetaData.fileExtensions, createStatemachineServices());
        const generatedFilePath = generateCpp(statemachine, fileName, opts.destination);
        console.log(colors.green(`C++ code generated successfully: ${generatedFilePath}`));
    });

program.parse(process.argv);

export type GenerateOptions = {
    destination?: string;
}