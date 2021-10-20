/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Command } from 'commander';
import { createDomainModelServices } from '../language-server/domain-model-module';
import { Domainmodel } from '../language-server/generated/ast';
import { languageMetaData } from '../language-server/generated/module';
import { extractAstNode, setRootFolder } from './cli-util';
import { generateJava } from './generator';
import colors from 'colors';

export const generateAction = (fileName: string, opts: GenerateOptions): void => {
    const services = createDomainModelServices();
    setRootFolder(fileName, services, opts.root);
    const domainmodel = extractAstNode<Domainmodel>(fileName, languageMetaData.fileExtensions, services);
    const generatedDirPath = generateJava(domainmodel, fileName, opts.destination);
    console.log(colors.green(`Java classes generated successfully: ${colors.yellow(generatedDirPath)}`));
};

export type GenerateOptions = {
    destination?: string;
    root?: string;
}

export default function(): void {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require('../../package.json').version);

    program
        .command('generate')
        .argument('<file>', `possible file extensions: ${languageMetaData.fileExtensions.join(', ')}`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .option('-r, --root <dir>', 'source root folder')
        .description('generates Java classes by Entity description')
        .action(generateAction);

    program.parse(process.argv);
}