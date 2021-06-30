/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as fs from 'fs-extra';
import { Package } from './package';
import { Grammar, createLangiumGrammarServices, LangiumDocumentConfiguration, resolveAllReferences } from 'langium';
import { generateGrammarAccess } from './generator/grammar-access-generator';
import { generateParser } from './generator/parser-generator';
import { generateAst } from './generator/ast-generator';
import { generateModule } from './generator/module-generator';
import { generateTextMate } from './generator/textmate-generator';
import path from 'path';
import { serializeGrammar } from './generator/grammar-serializer';

export type GenerateOptions = {
    file?: string;
}

export function generate(opts: GenerateOptions): void {
    const file = opts.file ?? './package.json';
    const packageContent = fs.readFileSync(file).toString();
    const pack = <Package>JSON.parse(packageContent);

    const services = createLangiumGrammarServices();

    const grammarFile = pack.langium.grammar ?? 'src/grammar.langium';
    const grammarFileContent = fs.readFileSync(grammarFile).toString();
    const document = LangiumDocumentConfiguration.create(`file:${grammarFile}`, 'langium', 0, grammarFileContent);
    services.documents.DocumentBuilder.build(document);
    if (!document.parseResult) {
        console.error('Failed to parse the grammar file: ' + grammarFile);
        process.exit(1);
    }
    const grammar = document.parseResult.value as Grammar;
    document.precomputedScopes = services.references.ScopeComputation.computeScope(document);
    resolveAllReferences(grammar);

    const output = pack.langium.out ?? 'src/generated';
    console.log(`Writing generated files to '${output}'`);
    fs.mkdirsSync(output);

    console.log('Generating serialized grammar...');
    const serializedGrammar = serializeGrammar(services, grammar, pack.langium);
    fs.writeFileSync(`${output}/grammar.ts`, serializedGrammar);

    console.log('Generating parser...');
    const parser = generateParser(grammar, pack.langium);
    fs.writeFileSync(`${output}/parser.ts`, parser);

    console.log('Generating grammar access...');
    const grammarAccess = generateGrammarAccess(grammar, pack.langium);
    fs.writeFileSync(`${output}/grammar-access.ts`, grammarAccess);

    console.log('Generating AST...');
    const genAst = generateAst(grammar, pack.langium);
    fs.writeFileSync(`${output}/ast.ts`, genAst);

    console.log('Generating dependency injection module...');
    const genModule = generateModule(grammar, pack.langium);
    fs.writeFileSync(`${output}/module.ts`, genModule);

    if (pack.langium.textMate) {
        if (!pack.langium.languageId) {
            console.error('Language Id needs to be set in order to generate the textmate grammars.');
        } else {
            console.log('Generating textmate grammars');
            const genTmGrammar = generateTextMate(grammar, pack.langium);
            console.log(`Writing textmate grammars to '${pack.langium.textMate.out}'`);
            const parentDir = path.dirname(pack.langium.textMate.out).split(path.sep).pop();
            parentDir && fs.mkdirsSync(parentDir);
            fs.writeFileSync(pack.langium.textMate.out, genTmGrammar);
        }
    }
}
