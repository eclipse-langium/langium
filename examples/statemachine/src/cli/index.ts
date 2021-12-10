/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import colors from 'colors';
import { Command } from 'commander';
import { Statemachine } from '../language-server/generated/ast';
import { StatemachineLanguageMetaData } from '../language-server/generated/module';
import { createStatemachineServices } from '../language-server/statemachine-module';
import { extractAstNode } from './cli-util';
import { generateCpp } from './generator';
import { URI } from 'vscode-uri';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const fileUri = URI.file(fileName);
    const services = createStatemachineServices().ServiceRegistry.getService(fileUri);
    const statemachine = await extractAstNode<Statemachine>(fileName, StatemachineLanguageMetaData.fileExtensions, services);
    const generatedFilePath = generateCpp(statemachine, fileName, opts.destination);
    console.log(colors.green(`C++ code generated successfully: ${generatedFilePath}`));
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