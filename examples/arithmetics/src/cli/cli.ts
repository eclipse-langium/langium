/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import 'chalk';
import { Command } from 'commander';
import { ArithmeticsLanguageMetaData } from '../language-server/generated/module.js';
import { evalAction } from './interpreter.js';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { generateAction } from './generator.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

const program = new Command();

program.version(JSON.parse(packageContent).version);

program
    .command('eval')
    .argument('<file>', `possible file extensions: ${ArithmeticsLanguageMetaData.fileExtensions.join(', ')}`)
    .description('calculates Evaluations in the source file')
    .action(evalAction);

program
    .command('generate')
    .argument('<file>', `source file (possible file extensions: ${ArithmeticsLanguageMetaData.fileExtensions.join(', ')}`)
    .option('-d, --destination <dir>', 'generating destination directory')
    .option('-r, --return', 'the main function returns the last evaluation as a value')
    .description('generates LLVM IR for a source file')
    .action(generateAction);

program.parse(process.argv);
