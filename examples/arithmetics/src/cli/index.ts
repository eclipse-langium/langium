/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import path from 'path';
import colors from 'colors';
import { URI } from 'vscode-uri';
import { Command } from 'commander';
import { Grammar, DefaultDocumentValidator } from 'langium';
import { createArithmeticsServices } from '../language-server/arithmetics-module';
import { isModule } from '../language-server/generated/ast';
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

        const arithmeticsServices = createArithmeticsServices();
        const document = arithmeticsServices.documents.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
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
                console.error(colors.red(
                    `line ${validationError.range.start.line}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
                ));
            }
            process.exit(1);
        }

        const grammar = document.parseResult.value as Grammar;
        if (isModule(grammar)) {
            for (const [evaluation, value] of new ArithmeticsInterpreter().eval(grammar)) {
                const cstNode = evaluation.expression.$cstNode;
                if (cstNode) {
                    const line = document.textDocument.positionAt(cstNode.offset).line + 1;
                    console.log(`line ${line}:`, colors.green(cstNode.text), '===>', value);
                }
            }
        }
    });

program.parse(process.argv);
