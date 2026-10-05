/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import { EmptyFileSystem, GrammarAST } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { createGrammarDiagramSvg, createRuleDiagramSvg } from 'langium-railroad';
import { describe, expect, test } from 'vitest';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper<Grammar>(services);

async function parseRules(rules: string): Promise<Map<string, GrammarAST.ParserRule>> {
    const document = await parse(`
        grammar Test
        ${rules}
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `);
    const parserRules = document.parseResult.value.rules.filter(GrammarAST.isParserRule);
    return new Map(parserRules.map(rule => [rule.name, rule]));
}

async function diagramOf(rules: string, name: string): Promise<string> {
    const rule = (await parseRules(rules)).get(name);
    expect(rule).toBeDefined();
    return createRuleDiagramSvg(rule!);
}

describe('createRuleDiagramSvg', () => {

    test('creates a standalone SVG', async () => {
        const svg = await diagramOf("entry A: 'a' name=ID;", 'A');
        expect(svg).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        expect(svg).toContain('<style>');
        expect(svg).toContain('>a</text>');
        expect(svg).toContain('>ID</text>');
    });

    test('matches the corresponding entry of createGrammarDiagramSvg', async () => {
        const rules = await parseRules("entry A: 'a' b=B; B: 'b';");
        const diagrams = createGrammarDiagramSvg(Array.from(rules.values()));
        expect(diagrams.get('A')).toBe(createRuleDiagramSvg(rules.get('A')!));
        expect(diagrams.get('B')).toBe(createRuleDiagramSvg(rules.get('B')!));
    });

    test('does not throw if all alternatives are actions', async () => {
        const svg = await diagramOf('entry A: {infer A1} | {infer A2};', 'A');
        expect(svg).toMatch(/^<svg /);
    });

    test('draws an action-only alternative as an empty path', async () => {
        const withAction = await diagramOf("entry A: 'a' | {infer B};", 'A');
        const optional = await diagramOf("entry A: 'a'?;", 'A');
        expect(withAction).toBe(optional);
    });

    test('keeps the other alternatives next to an action-only alternative', async () => {
        const withAction = await diagramOf("entry A: 'a' | 'b' | {infer C};", 'A');
        const optional = await diagramOf("entry A: ('a' | 'b')?;", 'A');
        expect(withAction).toBe(optional);
    });

    test('draws unresolved rule calls by their reference text', async () => {
        const svg = await diagramOf("entry A: 'a' b=Missing;", 'A');
        expect(svg).toContain('>Missing</text>');
    });

    test('does not recurse endlessly if a name is a cross-reference itself', async () => {
        const self = await diagramOf('entry A: name=[A];', 'A');
        expect(self).toContain('>UNKNOWN</text>');
        const mutual = await diagramOf('entry A: name=[B]; B: name=[A];', 'A');
        expect(mutual).toContain('>UNKNOWN</text>');
    });

    test('does not throw for incomplete alternatives', async () => {
        const svg = await diagramOf("entry A: 'a' | ;", 'A');
        expect(svg).toMatch(/^<svg /);
    });

});
