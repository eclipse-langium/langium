/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import colors from 'colors';
import { Command } from 'commander';
import { createDomainModelServices } from '../language-server/domain-model-module';
import { Domainmodel } from '../language-server/generated/ast';
import { languageMetaData } from '../language-server/generated/module';
import { extractAstNode } from './cli-util';
import { generateJava } from './generator';

const program = new Command();

program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../../package.json').version);

program
    .command('generate')
    .argument('<file>', `possible file extensions: ${languageMetaData.fileExtensions.join(', ')}`)
    .option('-d, --destination <dir>', 'destination directory of generating')
    .description('generates Java classes by Entity description')
    .action((fileName: string, opts: GenerateOptions) => {
        const domainmodel = extractAstNode<Domainmodel>(fileName, languageMetaData.languageId, languageMetaData.fileExtensions, createDomainModelServices());
        const generatedDirPath = generateJava(domainmodel, fileName, opts.destination);
        console.log(colors.green('Java classes generated successfully:'), colors.yellow(generatedDirPath));
    });

program.parse(process.argv);

export type GenerateOptions = {
    destination?: string;
}
