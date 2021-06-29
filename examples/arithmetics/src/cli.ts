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
import { isModule } from './language-server/generated/ast';
import { ArithmeticsInterpreter } from './interpreter';

const program = new Command();
program
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../package.json').version);

program
    .command('eval')
    .argument('<file>', 'the .calc file')
    .description('calculate Evaluations in the .calc file')
    .action((fileName: string) => {
        if (!/^.*\.calc$/.test(fileName)) {
            console.error('Please, choose a file with the .calc extension.');
            process.exit(1);
        }

        if (!fs.existsSync(fileName)) {
            console.error(`File ${fileName} doesn't exist.`);
            process.exit(1);
        }
        const fileContent = fs.readFileSync(fileName).toString();

        const arithmeticsServices = createArithmeticsServices();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const languageId = require('../package.json').contributes.languages.id;
        const document = LangiumDocumentConfiguration.create(`file:${fileName}`, languageId, 0, fileContent);
        arithmeticsServices.documents.DocumentBuilder.build(document);
        if (!document.parseResult) {
            console.error(`Failed to parse the grammar file ${fileName}`);
            process.exit(1);
        }

        const validationErrors = new DefaultDocumentValidator(arithmeticsServices)
            .validateDocument(document)
            .filter(e => e.severity === 1);
        if (validationErrors.length > 0) {
            console.error('There are validation errors:');
            for (const validationError of validationErrors) {
                console.error(validationError.range.start, '-', validationError.range.end, ':', validationError.message);
            }
            process.exit(1);
        }

        const grammar = document.parseResult.value as Grammar;
        const evaluator = new ArithmeticsInterpreter();
        if (isModule(grammar)) {
            for (const [expr, value] of evaluator.eval(grammar)) {
                console.error(colors.green(expr), '===>', value);
            }
        }
    });

program.parse(process.argv);
