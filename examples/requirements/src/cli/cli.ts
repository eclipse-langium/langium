/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import chalk from 'chalk';
import { Command } from 'commander';
import { RequirementsLanguageMetaData } from '../language-server/generated/module.js';
import { createRequirementsAndTestsLangServices } from '../language-server/requirements-and-tests-lang-module.js';
import { extractRequirementModelWithTestModels } from './cli-util.js';
import { generateSummary } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createRequirementsAndTestsLangServices(NodeFileSystem).requirements;
    const [requirementModel, testModels]  = await extractRequirementModelWithTestModels(fileName, services);
    const generatedFilePath = generateSummary(requirementModel, testModels, fileName, opts.destination);
    console.log(chalk.green(`Requirement coverage generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

const program = new Command();

program.version(JSON.parse(packageContent).version);

const fileExtensions = RequirementsLanguageMetaData.fileExtensions.join(', ');
program
    .command('generate')
    .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
    .option('-d, --destination <dir>', 'destination directory of generating')
    .description('generates a table for requirement coverage of requirements of that file')
    .action(generateAction);

program.parse(process.argv);
