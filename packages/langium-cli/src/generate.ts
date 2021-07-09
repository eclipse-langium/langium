/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import path from 'path';
import { LangiumConfig, RelativePath } from './package';
import { Grammar, createLangiumGrammarServices, LangiumDocumentConfiguration } from 'langium';
import { Diagnostic } from 'vscode-languageserver-types';
import { generateGrammarAccess } from './generator/grammar-access-generator';
import { generateParser } from './generator/parser-generator';
import { generateAst } from './generator/ast-generator';
import { generateModule } from './generator/module-generator';
import { generateTextMate } from './generator/textmate-generator';
import { serializeGrammar } from './generator/grammar-serializer';

export type GenerateOptions = {
    file?: string;
}

export function generate(config: LangiumConfig): void {
    const services = createLangiumGrammarServices();
    const relPath = config[RelativePath];

    let grammarFileContent: string;
    try {
        grammarFileContent = fs.readFileSync(path.join(relPath, config.grammar), 'utf-8');
    } catch (e) {
        exit(`Failed to read grammar file at ${path.join(relPath, config.grammar).red.bold}`, e);
    }
    const document = LangiumDocumentConfiguration.create(`file:${config.grammar}`, 'langium', 0, grammarFileContent);
    const diagnostics: Diagnostic[] = [];
    services.documents.DocumentBuilder.build(document, diagnostics);
    if (!document.parseResult) {
        console.error('Failed to parse the grammar file: ' + config.grammar);
        exit(`Langium generator ${'failed'.red.bold}.`);
    } else if (diagnostics?.length && diagnostics.some(e => e.severity === 1)) {
        console.error('Grammar contains validation errors:');
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
        exit(`Langium generator ${'failed'.red.bold}.`);
    }
    const grammar = document.parseResult.value as Grammar;

    const output = path.join(relPath, config.out ?? 'src/generated');
    console.log(`Writing generated files to ${output.white.bold}`);
    mkdirWithFail(output);

    const genAst = generateAst(grammar, config);
    writeWithFail(path.join(output, 'ast.ts'), genAst);

    const serializedGrammar = serializeGrammar(services, grammar, config);
    writeWithFail(path.join(output, 'grammar.ts'), serializedGrammar);

    const grammarAccess = generateGrammarAccess(grammar, config);
    writeWithFail(path.join(output, 'grammar-access.ts'), grammarAccess);

    const parser = generateParser(grammar, config);
    writeWithFail(path.join(output, 'parser.ts'), parser);

    console.log('Generating dependency injection module...');
    const genModule = generateModule(grammar, config);
    writeWithFail(path.join(output, 'module.ts'), genModule);

    if (config.textMate) {
        if (!config.languageId) {
            console.error('Language Id needs to be set in order to generate the textmate grammar.'.red);
        } else {
            const genTmGrammar = generateTextMate(grammar, config);
            const textMatePath = path.join(relPath, config.textMate.out);
            console.log(`Writing textmate grammar to ${textMatePath.white.bold}`);
            const parentDir = path.dirname(textMatePath).split(path.sep).pop();
            parentDir && mkdirWithFail(parentDir);
            writeWithFail(textMatePath, genTmGrammar);
        }
    }
}

export function exit(reason: string, ...args: unknown[]): never {
    console.error(reason, ...args);
    return process.exit(1);
}

function mkdirWithFail(path: string): void {
    try {
        fs.mkdirsSync(path);
    } catch (e) {
        exit(`Failed to create directory ${path.red.bold}`, e);
    }
}

function writeWithFail(path: string, content: string): void {
    try {
        fs.writeFileSync(path, content);
    } catch (e) {
        exit(`Failed to write file to ${path.red.bold}`, e);
    }
}
