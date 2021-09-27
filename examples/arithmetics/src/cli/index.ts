/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import colors from 'colors';
import { Command } from 'commander';
import { createArithmeticsServices } from '../language-server/arithmetics-module';
import { Module } from '../language-server/generated/ast';
import { languageMetaData } from '../language-server/generated/module';
import { extractDocument } from './cli-util';
import { interpretEvaluations } from './interpreter';

export const evalAction = (fileName: string): void => {
    const document = extractDocument(fileName, languageMetaData.fileExtensions, createArithmeticsServices());
    const module = document.parseResult?.value as Module;
    for (const [evaluation, value] of interpretEvaluations(module)) {
        const cstNode = evaluation.expression.$cstNode;
        if (cstNode) {
            const line = document.textDocument.positionAt(cstNode.offset).line + 1;
            console.log(`line ${line}:`, colors.green(cstNode.text), '===>', value);
        }
    }
};

export default function(): void {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require('../../package.json').version);

    program
        .command('eval')
        .argument('<file>', `possible file extensions: ${languageMetaData.fileExtensions.join(', ')}`)
        .description('calculates Evaluations in the source file')
        .action(evalAction);

    program.parse(process.argv);
}
