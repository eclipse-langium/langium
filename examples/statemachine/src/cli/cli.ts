/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import chalk from 'chalk';
import { Command } from 'commander';
import { NodeFileSystem } from 'langium/node';
import type { Statemachine } from '../language-server/generated/ast.js';
import { StatemachineModelLanguageMetaData } from '../language-server/generated/module.js';
import { createStatemachineServices } from '../language-server/statemachine-module.js';
import { extractAstNode } from './cli-util.js';
import { generateCpp } from './generator.js';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createStatemachineServices(NodeFileSystem).statemachine;
    const statemachine = await extractAstNode<Statemachine>(fileName, StatemachineModelLanguageMetaData.fileExtensions, services);
    const generatedFilePath = generateCpp(statemachine, fileName, opts.destination);
    console.log(chalk.green(`C++ code generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

const program = new Command();

program.version(JSON.parse(packageContent).version);

program
    .command('generate')
    .argument('<file>', `possible file extensions: ${StatemachineModelLanguageMetaData.fileExtensions.join(', ')}`)
    .option('-d, --destination <dir>', 'destination directory of generating')
    .description('generates a C++ CLI to walk over states')
    .action(generateAction);

program.parse(process.argv);
