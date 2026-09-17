/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import { EmptyFileSystem, URI } from 'langium';
import type { LangiumConfig } from '../../src/package-types.js';
import { RelativePath } from '../../src/package-types.js';
import { embedGrammars, type GenerateOptions, type LanguageInfo } from '../../src/generate.js';
import { generateBnf } from '../../src/generator/bnf-generator.js';
import { createLangiumGrammarServices } from 'langium/grammar';
import { clearDocuments } from 'langium/test';
import { afterEach, describe, expect, test } from 'vitest';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem);

const INNER_GRAMMAR = `
grammar Inner

entry InnerEntry: elements+=InnerRule;

/**
 * Documentation for InnerRule.
 */
InnerRule: 'inner' name=ID;

/**
 * Documentation for InnerType.
 */
type InnerType = InnerRule;

terminal ID: /[_a-zA-Z][\w_]*/;
`;

const OUTER_GRAMMAR = `
grammar Outer

import './inner'

/**
 * Documentation for Model.
 */
entry Model:
    elements+=OuterRule;

/**
 * Documentation for OuterRule.
 */
OuterRule: 'outer' 'ref' target=[InnerRule:ID];
`;

async function embedOuterGrammar(): Promise<Grammar> {
    const factory = grammarServices.shared.workspace.LangiumDocumentFactory;
    const documents = grammarServices.shared.workspace.LangiumDocuments;
    const innerDoc = factory.fromString<Grammar>(INNER_GRAMMAR, URI.file('/repro/inner.langium'));
    const outerDoc = factory.fromString<Grammar>(OUTER_GRAMMAR, URI.file('/repro/outer.langium'));
    documents.addDocument(innerDoc);
    documents.addDocument(outerDoc);
    await grammarServices.shared.workspace.DocumentBuilder.build([innerDoc, outerDoc]);

    const config: LangiumConfig = {
        projectName: 'Repro',
        languages: [],
        [RelativePath]: '/repro'
    };
    const languages: LanguageInfo[] = [{
        entryGrammar: outerDoc.parseResult.value as Grammar,
        embeddedGrammar: undefined as unknown as Grammar,
        languageConfig: {
            id: 'repro',
            grammar: 'outer.langium',
            fileExtensions: ['.repro']
        },
        identifier: 'Repro'
    }];
    const options: GenerateOptions = {};
    const success = await embedGrammars(languages, config, options, grammarServices.grammar);
    expect(success).toBe(true);
    return languages[0].embeddedGrammar;
}

describe('embedGrammars', () => {

    afterEach(() => {
        clearDocuments(grammarServices.shared);
    });

    test('keeps the CST node of embedded elements', async () => {
        const embedded = await embedOuterGrammar();
        const innerRule = embedded.rules.find(rule => rule.name === 'InnerRule');
        expect(innerRule).toBeDefined();
        // copyAstNode drops the $cstNode; it must be re-attached for comment consumers
        expect(innerRule?.$cstNode).toBeDefined();
        const innerType = embedded.types.find(type => type.name === 'InnerType');
        expect(innerType?.$cstNode).toBeDefined();
    });

    test('keeps doc comments of imported rules in the BNF output (#2065)', async () => {
        const embedded = await embedOuterGrammar();
        const generated = generateBnf([embedded]);
        expect(generated).toContain('Documentation for InnerRule.');
    });

    test('keeps doc comments of imported elements in the serialized grammar (#2065)', async () => {
        const embedded = await embedOuterGrammar();
        const serialized = grammarServices.grammar.serializer.JsonSerializer.serialize(embedded, {
            comments: true
        });
        const json = JSON.parse(serialized) as { rules: Array<{ name: string, $comment?: string }>, types: Array<{ name: string, $comment?: string }> };
        const innerRule = json.rules.find(rule => rule.name === 'InnerRule');
        expect(innerRule?.$comment).toContain('Documentation for InnerRule.');
        const innerType = json.types.find(type => type.name === 'InnerType');
        expect(innerType?.$comment).toContain('Documentation for InnerType.');
    });
});
