/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import colors from 'colors';
import { AstNode, LangiumDocument, LangiumServices } from 'langium';
import path from 'path';
import { URI } from 'vscode-uri';
import { WorkspaceFolder } from 'vscode-languageserver';

export async function extractDocument<T extends AstNode>(fileName: string, extensions: string[], services: LangiumServices): Promise<LangiumDocument<T>> {
    if (!extensions.includes(path.extname(fileName))) {
        console.error(colors.yellow(`Please, choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(colors.red(`File ${fileName} doesn't exist.`));
        process.exit(1);
    }

    const document = services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
    const buildResult = await services.shared.workspace.DocumentBuilder.build(document);

    const validationErrors = buildResult.diagnostics.filter(e => e.severity === 1);
    if (validationErrors.length > 0) {
        console.error(colors.red('There are validation errors:'));
        for (const validationError of validationErrors) {
            console.error(colors.red(
                `line ${validationError.range.start.line}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
            ));
        }
        process.exit(1);
    }

    return document as LangiumDocument<T>;
}

export async function extractAstNode<T extends AstNode>(fileName: string, extensions: string[], services: LangiumServices): Promise<T> {
    return (await extractDocument(fileName, extensions, services)).parseResult.value as T;
}

export async function setRootFolder(fileName: string, services: LangiumServices, root?: string): Promise<void> {
    const folders: WorkspaceFolder[] = [];
    if(!root) {
        root = path.dirname(fileName);
    }
    folders.push({
        name: path.basename(root),
        uri: path.resolve(root)
    });
    await services.shared.workspace.IndexManager.initializeWorkspace(folders);
}

interface FilePathData {
    destination: string,
    name: string
}

export function extractDestinationAndName(filePath: string, destination: string | undefined): FilePathData {
    filePath = filePath.replace(/\..*$/, '').replace(/[.-]/g, '');
    return {
        destination: destination ?? path.join(path.dirname(filePath), 'generated'),
        name: path.basename(filePath)
    };
}
