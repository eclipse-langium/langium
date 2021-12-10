/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import 'colors';
import { Command } from 'commander';
import { ArithmeticsLanguageMetaData } from '../language-server/generated/module';
import { evalAction } from './interpreter';

const program = new Command();

program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../../package.json').version);

program
    .command('eval')
    .argument('<file>', `possible file extensions: ${ArithmeticsLanguageMetaData.fileExtensions.join(', ')}`)
    .description('calculates Evaluations in the source file')
    .action(evalAction);

program.parse(process.argv);
