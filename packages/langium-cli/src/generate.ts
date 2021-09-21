/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import path from 'path';
import { LangiumConfig, RelativePath } from './package';
import { createLangiumGrammarServices, isGrammar } from 'langium';
import { URI } from 'vscode-uri';
import { generateAst } from './generator/ast-generator';
import { generateModule } from './generator/module-generator';
import { generateTextMate } from './generator/textmate-generator';
import { serializeGrammar } from './generator/grammar-serializer';
import { getTime, getUserChoice } from './generator/util';

export type GenerateOptions = {
    file?: string;
    watch: boolean
}

export type GeneratorResult = 'success' | 'failure';

const services = createLangiumGrammarServices();

export async function generate(config: LangiumConfig): Promise<GeneratorResult> {
    const relPath = config[RelativePath];
    const absGrammarPath = URI.file(path.resolve(relPath, config.grammar));
    services.documents.LangiumDocuments.invalidateDocument(absGrammarPath);
    const document = services.documents.LangiumDocuments.getOrCreateDocument(absGrammarPath);
    const buildResult = services.documents.DocumentBuilder.build(document);
    const diagnostics = buildResult.diagnostics;
    if (!isGrammar(buildResult.parseResult.value)) {
        console.error(getTime() + 'Failed to parse the grammar file: ' + config.grammar);
        return 'failure';
    } else if (diagnostics?.length && diagnostics.some(e => e.severity === 1)) {
        console.error(getTime() + 'Grammar contains validation errors:');
        diagnostics.forEach(e => {
            const message = `${e.range.start.line}:${e.range.start.character} - ${e.message}`;
            if (e.severity === 1) {
                console.error(message.red);
            } else if (e.severity === 2) {
                console.warn(message.yellow);
            } else {
                console.log(message);
            }
        });
        console.error(`${getTime()}Langium generator ${'failed'.red.bold}.`);
        return 'failure';
    }
    const grammar = buildResult.parseResult.value;

    const output = path.resolve(relPath, config.out ?? 'src/generated');
    console.log(`${getTime()}Writing generated files to ${output.white.bold}`);

    if (await rmdirWithFail(output, ['ast.ts', 'grammar.ts', 'grammar-access.ts', 'parser.ts', 'module.ts'])) {
        return 'failure';
    }
    if (await mkdirWithFail(output)) {
        return 'failure';
    }

    const genAst = generateAst(grammar, config);
    await writeWithFail(path.resolve(output, 'ast.ts'), genAst);

    const serializedGrammar = serializeGrammar(services, grammar, config);
    await writeWithFail(path.resolve(output, 'grammar.ts'), serializedGrammar);

    const genModule = generateModule(grammar, config);
    await writeWithFail(path.resolve(output, 'module.ts'), genModule);

    if (config.textMate) {
        const genTmGrammar = generateTextMate(grammar, config);
        const textMatePath = path.resolve(relPath, config.textMate.out);
        console.log(`${getTime()}Writing textmate grammar to ${textMatePath.white.bold}`);
        const parentDir = path.dirname(textMatePath).split(path.sep).pop();
        parentDir && await mkdirWithFail(parentDir);
        await writeWithFail(textMatePath, genTmGrammar);
    }
    return 'success';
}

async function rmdirWithFail(dirPath: string, expectedFiles?: string[]): Promise<boolean> {
    try {
        let deleteDir = true;
        const dirExists = await fs.pathExists(dirPath);
        if(dirExists) {
            if (expectedFiles) {
                const existingFiles = await fs.readdir(dirPath);
                const unexpectedFiles = existingFiles.filter(file => !expectedFiles.includes(path.basename(file)));
                if (unexpectedFiles.length > 0) {
                    console.log(`${getTime()}Found unexpected files in the generated directory: ${unexpectedFiles.map(e => e.yellow).join(', ')}`);
                    deleteDir = await getUserChoice(`${getTime()}Do you want to delete the files?`, ['yes', 'no'], 'yes') === 'yes';
                }
            }
            if (deleteDir) {
                await fs.remove(dirPath);
            }
        }
        return false;
    } catch (e) {
        console.error(`${getTime()}Failed to delete directory ${dirPath.red.bold}`, e);
        return true;
    }
}

async function mkdirWithFail(path: string): Promise<boolean> {
    try {
        await fs.mkdirs(path);
        return false;
    } catch (e) {
        console.error(`${getTime()}Failed to create directory ${path.red.bold}`, e);
        return true;
    }
}

async function writeWithFail(path: string, content: string): Promise<void> {
    try {
        await fs.writeFile(path, content);
    } catch (e) {
        console.error(`${getTime()}Failed to write file to ${path.red.bold}`, e);
    }
}
