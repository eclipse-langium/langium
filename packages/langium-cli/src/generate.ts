/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs-extra';
import path from 'path';
import { LangiumConfig, AbsolutePath } from './package';
import { Grammar, createLangiumGrammarServices, LangiumDocumentConfiguration } from 'langium';
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
    const absPath = config[AbsolutePath];

    const grammarFile = config.grammar ?? 'src/grammar.langium';
    const grammarFileContent = fs.readFileSync(path.join(absPath, grammarFile)).toString();
    const document = LangiumDocumentConfiguration.create(`file:${grammarFile}`, 'langium', 0, grammarFileContent);
    services.documents.DocumentBuilder.build(document);
    if (!document.parseResult) {
        console.error('Failed to parse the grammar file: ' + grammarFile);
        console.log(`Langium generator ${'failed'.red.bold}.`);
        process.exit(1);
    } else if (document.diagnostics?.length && document.diagnostics.some(e => e.severity === 1)) {
        console.error('Grammar contains validation errors:');
        document.diagnostics.forEach(e => {
            const message = `${e.range.start.line}:${e.range.start.character} - ${e.message}`;
            if (e.severity === 1) {
                console.error(message.red);
            } else if (e.severity === 2) {
                console.warn(message.yellow);
            } else {
                console.log(message);
            }
        });
        console.log('Langium generator ' + 'failed'.red.bold + '.');
        process.exit(1);
    }
    const grammar = document.parseResult.value as Grammar;

    const output = path.relative(process.cwd(), path.join(absPath, config.out ?? 'src/generated'));
    console.log(`Writing generated files to ${output.white.bold}`);
    fs.mkdirsSync(output);

    console.log('Generating AST...');
    const genAst = generateAst(grammar, config);
    fs.writeFileSync(`${output}/ast.ts`, genAst);

    console.log('Generating serialized grammar...');
    const serializedGrammar = serializeGrammar(services, grammar, config);
    fs.writeFileSync(`${output}/grammar.ts`, serializedGrammar);

    console.log('Generating grammar access...');
    const grammarAccess = generateGrammarAccess(grammar, config);
    fs.writeFileSync(`${output}/grammar-access.ts`, grammarAccess);

    console.log('Generating parser...');
    const parser = generateParser(grammar, config);
    fs.writeFileSync(`${output}/parser.ts`, parser);

    console.log('Generating dependency injection module...');
    const genModule = generateModule(grammar, config);
    fs.writeFileSync(`${output}/module.ts`, genModule);

    if (config.textMate) {
        if (!config.languageId) {
            console.error('Language Id needs to be set in order to generate the textmate grammars.'.red);
        } else {
            console.log('Generating textmate grammars');
            const genTmGrammar = generateTextMate(grammar, config);
            const textMatePath = path.join(absPath, config.textMate.out);
            console.log(`Writing textmate grammars to '${textMatePath}'`);
            const parentDir = path.dirname(textMatePath).split(path.sep).pop();
            parentDir && fs.mkdirsSync(parentDir);
            fs.writeFileSync(textMatePath, genTmGrammar);
        }
    }

    console.log(`Langium generator finished ${'successfully'.green.bold} in: ${elapsedTime()}ms`);
}
