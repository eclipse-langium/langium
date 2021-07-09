/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import path from 'path';
import { LangiumConfig, RelativePath } from './package';
import { createLangiumGrammarServices, LangiumDocumentConfiguration, isGrammar } from 'langium';
import { generateGrammarAccess } from './generator/grammar-access-generator';
import { generateParser } from './generator/parser-generator';
import { generateAst } from './generator/ast-generator';
import { generateModule } from './generator/module-generator';
import { generateTextMate } from './generator/textmate-generator';
import { serializeGrammar } from './generator/grammar-serializer';
import { getTime } from './generator/util';

export type GenerateOptions = {
    file?: string;
    watch: boolean
}

const services = createLangiumGrammarServices();

export function generate(config: LangiumConfig): boolean {
    const relPath = config[RelativePath];

    let grammarFileContent: string;
    try {
        grammarFileContent = fs.readFileSync(path.join(relPath, config.grammar), 'utf-8');
    } catch (e) {
        console.error(`${getTime()}Failed to read grammar file at ${path.join(relPath, config.grammar).red.bold}`, e);
        return false;
    }
    const document = LangiumDocumentConfiguration.create(`file:${config.grammar}`, 'langium', 0, grammarFileContent);
    const buildResult = services.documents.DocumentBuilder.build(document);
    const diagnostics = buildResult.diagnostics;
    if (!isGrammar(buildResult.parseResult.value)) {
        console.error(getTime() + 'Failed to parse the grammar file: ' + config.grammar);
        return false;
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
        return false;
    }
    const grammar = buildResult.parseResult.value;

    const output = path.join(relPath, config.out ?? 'src/generated');
    console.log(`${getTime()}Writing generated files to ${output.white.bold}`);
    mkdirWithFail(output);

    const genAst = generateAst(grammar, config);
    writeWithFail(path.join(output, 'ast.ts'), genAst);

    const serializedGrammar = serializeGrammar(services, grammar, config);
    writeWithFail(path.join(output, 'grammar.ts'), serializedGrammar);


    const genModule = generateModule(grammar, config);
    writeWithFail(path.join(output, 'module.ts'), genModule);

    if (config.textMate) {
        const genTmGrammar = generateTextMate(grammar, config);
        const textMatePath = path.join(relPath, config.textMate.out);
        console.log(`${getTime()}Writing textmate grammar to ${textMatePath.white.bold}`);
        const parentDir = path.dirname(textMatePath).split(path.sep).pop();
        parentDir && mkdirWithFail(parentDir);
        writeWithFail(textMatePath, genTmGrammar);
    }
    return true;
}

function mkdirWithFail(path: string): void {
    try {
        fs.mkdirsSync(path);
    } catch (e) {
        console.error(`${getTime()}Failed to create directory ${path.red.bold}`, e);
    }
}

function writeWithFail(path: string, content: string): void {
    try {
        fs.writeFileSync(path, content);
    } catch (e) {
        console.error(`${getTime()}Failed to write file to ${path.red.bold}`, e);
    }
}
