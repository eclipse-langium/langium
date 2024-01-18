/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, LangiumDocument, LangiumCoreServices } from 'langium';
import { URI } from 'langium';
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

export async function extractDocument<T extends AstNode>(fileName: string, extensions: readonly string[], services: LangiumCoreServices): Promise<LangiumDocument<T>> {
    if (!extensions.includes(path.extname(fileName))) {
        console.error(chalk.yellow(`Please, choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} doesn't exist.`));
        process.exit(1);
    }

    const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
    await services.shared.workspace.DocumentBuilder.build([document], { validation: true });

    const validationErrors = (document.diagnostics ?? []).filter(e => e.severity === 1);
    if (validationErrors.length > 0) {
        console.error(chalk.red('There are validation errors:'));
        for (const validationError of validationErrors) {
            console.error(chalk.red(
                `line ${validationError.range.start.line}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
            ));
        }
        process.exit(1);
    }

    return document as LangiumDocument<T>;
}

export async function extractAstNode<T extends AstNode>(fileName: string, extensions: string[], services: LangiumCoreServices): Promise<T> {
    return (await extractDocument(fileName, extensions, services)).parseResult.value as T;
}
