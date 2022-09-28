/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import chalk from 'chalk';
import { Command } from 'commander';
import { RequirementsLanguageMetaData } from '../language-server/generated/module';
import { createRequirementsAndTestsLangServices } from '../language-server/requirements-and-tests-lang-module';
import { extractRequirementModelWithTestModels } from './cli-util';
import { generateSummary } from './generator';
import { NodeFileSystem } from 'langium/node';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createRequirementsAndTestsLangServices(NodeFileSystem).RequirementsLang;
    const [requirementModel, testModels]  = await extractRequirementModelWithTestModels(fileName, services);
    const generatedFilePath = generateSummary(requirementModel, testModels, fileName, opts.destination);
    console.log(chalk.green(`Requirement coverage generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require('../../package.json').version);

    const fileExtensions = RequirementsLanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates a table for requirement coverage of requirements of that file')
        .action(generateAction);

    program.parse(process.argv);
}
