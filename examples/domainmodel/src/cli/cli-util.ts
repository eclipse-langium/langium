/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as fs from 'fs';
import colors from 'colors';
import { DefaultDocumentValidator, Grammar, LangiumDocumentConfiguration, LangiumServices } from 'langium';
import { Package } from 'langium-cli/src/package';

export function extractGrammar(fileName: string, configFileName: string, services: LangiumServices): Grammar {
    const packageContent = fs.readFileSync(configFileName).toString();
    const pack = <Package>JSON.parse(packageContent);

    const extensions = pack.langium.extensions;
    if (!new RegExp(`^.*${extensions?.join('|')}$`).test(fileName)) {
        console.error(`Please, choose a file with one of these extensions: ${extensions}.`);
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(`File ${fileName} doesn't exist.`);
        process.exit(1);
    }
    const fileContent = fs.readFileSync(fileName).toString();

    const languageId = pack.langium.languageId ? pack.langium.languageId : 'dummy-language-id';
    const document = LangiumDocumentConfiguration.create(`file:${fileName}`, languageId, 0, fileContent);
    services.documents.DocumentBuilder.build(document);
    if (!document.parseResult) {
        console.error(`Failed to parse the grammar file ${fileName}`);
        process.exit(1);
    }

    const validationErrors = new DefaultDocumentValidator(services)
        .validateDocument(document)
        .filter(e => e.severity === 1);
    if (validationErrors.length > 0) {
        console.error('There are validation errors:');
        for (const validationError of validationErrors) {
            console.error(colors.red(
                `line ${validationError.range.start.line}: ${validationError.message} [${document.getText(validationError.range)}]`
            ));
        }
        process.exit(1);
    }

    return document.parseResult?.value as Grammar;
}
