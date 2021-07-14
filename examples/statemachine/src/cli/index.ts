/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Command } from 'commander';
import { Statemachine } from '../language-server/generated/ast';
import { StatemachineLanguageMetaData } from '../language-server/generated/meta-data';
import { createStatemachineServices } from '../language-server/statemachine-module';
import { extractAstNode } from './cli-util';
import { StatemachineGenerator } from './generator';

const program = new Command();

program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../../package.json').version);

program
    .command('generate')
    .argument('<file>', 'the .statemachine file')
    .option('-d, --destination <dir>', 'destination directory of generating')
    .description('generate a C++ CLI to walk over states')
    .action((fileName: string, opts: GenerateOptions) => {
        const metaData = new StatemachineLanguageMetaData();
        const statemachine = extractAstNode<Statemachine>(fileName, metaData.languageId, metaData.extensions, createStatemachineServices());
        new StatemachineGenerator(statemachine, fileName, opts.destination).generate();
    });

program.parse(process.argv);

export type GenerateOptions = {
    destination?: string;
}