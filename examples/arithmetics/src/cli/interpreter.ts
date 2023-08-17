/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Module } from '../language-server/generated/ast.js';
import { NodeFileSystem } from 'langium/node';
import { createArithmeticsServices } from '../language-server/arithmetics-module.js';
import { ArithmeticsLanguageMetaData } from '../language-server/generated/module.js';
import { extractDocument } from './cli-util.js';
import chalk from 'chalk';
import { interpretEvaluations } from '../language-server/arithmetics-evaluator.js';

export const evalAction = async (fileName: string): Promise<void> => {
    const services = createArithmeticsServices(NodeFileSystem).arithmetics;
    const document = await extractDocument<Module>(fileName, ArithmeticsLanguageMetaData.fileExtensions, services);
    const module = document.parseResult.value;
    for (const [evaluation, value] of interpretEvaluations(module)) {
        const cstNode = evaluation.expression.$cstNode;
        if (cstNode) {
            const line = cstNode.range.start.line + 1;
            console.log(`line ${line}:`, chalk.green(cstNode.text), '===>', value);
        }
    }
};