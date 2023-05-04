/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import chalk from 'chalk';
import { Command } from 'commander';
import { NodeFileSystem } from 'langium/node';
import type { Statemachine } from '../language-server/generated/ast';
import { StatemachineLanguageMetaData } from '../language-server/generated/module';
import { createStatemachineServices } from '../language-server/statemachine-module';
import { extractAstNode } from './cli-util';
import { generateCpp } from './generator';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createStatemachineServices(NodeFileSystem).statemachine;
    const statemachine = await extractAstNode<Statemachine>(fileName, StatemachineLanguageMetaData.fileExtensions, services);
    const generatedFilePath = generateCpp(statemachine, fileName, opts.destination);
    console.log(chalk.green(`C++ code generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require('../../package.json').version);

    program
        .command('generate')
        .argument('<file>', `possible file extensions: ${StatemachineLanguageMetaData.fileExtensions.join(', ')}`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates a C++ CLI to walk over states')
        .action(generateAction);

    program.parse(process.argv);
}
