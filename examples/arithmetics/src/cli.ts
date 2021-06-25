/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as fs from 'fs';
import colors from 'colors';
import { Command } from 'commander';
import { Grammar, LangiumDocumentConfiguration, DefaultDocumentValidator } from 'langium';
import { createArithmeticsServices } from './language-server/arithmetics-module';
import { isModule, Module } from './language-server/generated/ast';
import { ArithmeticsInterpreter } from './interpreter';

const program = new Command();
program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../package.json').version);

program
    .command('eval')
    .description('calculate Evaluations in the .calc file')
    .option('-f, --file <file>', 'the .calc file')
    .action((options: EvalOptions) => {
        if (!options.file) {
            console.log('Please, enter a file name.');
            process.exit(1);
        }
        if (!isCalcExtension(options.file)) {
            console.log('Please, choose a file with the .calc extension.');
            process.exit(1);
        }

        if (!fs.existsSync(options.file)) {
            console.log('File doesn\'t exist: ' + options.file);
            process.exit(1);
        }
        const fileContent = fs.readFileSync(options.file).toString();

        const arithmeticsServices = createArithmeticsServices();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const languageId = require('../package.json').contributes.languages.id;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const version = require('../package.json').version;
        const document = LangiumDocumentConfiguration.create(`file:${options.file}`, languageId, version, fileContent);
        arithmeticsServices.documents.DocumentBuilder.build(document);
        if (!document.parseResult) {
            console.error('Failed to parse the grammar file: ' + options.file);
            process.exit(1);
        }

        const validationErrors = new DefaultDocumentValidator(arithmeticsServices).validateDocument(document);
        if (validationErrors.length > 0) {
            console.log('There are validation errors:');
            for (const validationError of validationErrors) {
                console.log(validationError.range.start, '-', validationError.range.end, ':', validationError.message);
            }
            process.exit(1);
        }

        const grammar = document.parseResult.value as Grammar;
        const evaluator = new ArithmeticsInterpreter();
        if (isModule(grammar)) {
            for (const [expr, value] of evaluator.eval(grammar as Module)) {
                console.log(colors.green(expr), '===>', value);
            }
        }
    });

program.parse(process.argv);

export type EvalOptions = {
    file?: string;
}

function isCalcExtension(fileName: string): boolean {
    return /^.*\.calc$/.test(fileName);
}

