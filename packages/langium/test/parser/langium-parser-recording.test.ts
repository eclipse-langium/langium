/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { beforeAll, describe, expect, test, vi } from 'vitest';
import { createServicesForGrammar } from '../../src/grammar/internal-grammar-util.js';
import type { AbstractLangiumParser } from '../../src/parser/langium-parser.js';
import { LangiumCompletionParser, LangiumParser } from '../../src/parser/langium-parser.js';
import { createParser } from '../../src/parser/parser-builder-base.js';
import type { LangiumCoreServices } from '../../src/services.js';

describe('AbstractLangiumParser.isRecording', () => {

    // Covers the parser features that check `isRecording()`: assignments, sub rules, fragments,
    // actions and unordered groups.
    const grammar = `
        grammar Test
        entry Model: 'model' name=ID items+=Item*;
        Item: Leaf ({infer Pair.left=current} 'with' right=Leaf)?;
        Leaf: 'leaf' name=ID Props;
        fragment Props: ('size' size=INT & 'color' color=ID)?;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        terminal INT returns number: /[0-9]+/;
        hidden terminal WS: /\\s+/;
    `;
    const input = 'model m leaf a color red size 1 with leaf b leaf c size 2 color blue';

    let services: LangiumCoreServices;

    beforeAll(async () => {
        services = await createServicesForGrammar({ grammar });
    });

    /**
     * Builds the parser rules without finalizing the parser, and records `isRecording()`
     * whenever a rule consumes a token or runs an action.
     */
    function prepareParser<T extends AbstractLangiumParser>(parser: T): { parser: T, observed: boolean[] } {
        createParser(services.Grammar, parser, services.parser.Lexer.definition);
        const observed: boolean[] = [];
        const consume = parser.consume.bind(parser);
        parser.consume = (idx, tokenType, feature) => {
            observed.push(parser.isRecording());
            consume(idx, tokenType, feature);
        };
        const action = parser.action.bind(parser);
        parser.action = ($type, act) => {
            observed.push(parser.isRecording());
            action($type, act);
        };
        return { parser, observed };
    }

    function spyOnWrapperRecording(parser: AbstractLangiumParser) {
        const wrapper = (parser as unknown as { wrapper: { readonly IS_RECORDING: boolean } }).wrapper;
        return vi.spyOn(wrapper, 'IS_RECORDING', 'get');
    }

    test.each([
        ['LangiumParser', () => new LangiumParser(services)],
        ['LangiumCompletionParser', () => new LangiumCompletionParser(services)]
    ])('%s is recording only while finalize() records the grammar', (_name, create) => {
        const { parser, observed } = prepareParser(create());
        expect(parser.isRecording()).toBe(false);

        parser.finalize();
        expect(observed.length).toBeGreaterThan(0);
        expect(observed.every(recording => recording)).toBe(true);
        expect(parser.isRecording()).toBe(false);

        observed.length = 0;
        parser.parse(input);
        expect(observed.length).toBeGreaterThan(0);
        expect(observed.some(recording => recording)).toBe(false);
    });

    test('is recording again while a repeated finalize() records the grammar', () => {
        const { parser, observed } = prepareParser(new LangiumParser(services));
        parser.finalize();

        observed.length = 0;
        parser.finalize();
        expect(observed.length).toBeGreaterThan(0);
        expect(observed.every(recording => recording)).toBe(true);
        expect(parser.isRecording()).toBe(false);
        expect(parser.parse(input).parserErrors).toHaveLength(0);
    });

    test('stops asking the Chevrotain wrapper once finalize() is done', () => {
        const { parser } = prepareParser(new LangiumParser(services));
        const spy = spyOnWrapperRecording(parser);
        try {
            expect(parser.isRecording()).toBe(false);
            expect(spy).toHaveBeenCalled();

            parser.finalize();
            spy.mockClear();
            parser.parse(input);
            expect(parser.isRecording()).toBe(false);
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    test('builds the AST after finalize()', () => {
        const { parser } = prepareParser(new LangiumParser(services));
        parser.finalize();
        const result = parser.parse(input);
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = result.value as any;
        expect(model.$type).toBe('Model');
        expect(model.name).toBe('m');
        expect(model.items).toHaveLength(2);
        const [pair, leaf] = model.items;
        expect(pair.$type).toBe('Pair');
        expect(pair.$container).toBe(model);
        expect(pair.left).toMatchObject({ $type: 'Leaf', name: 'a', size: 1, color: 'red' });
        expect(pair.left.$container).toBe(pair);
        expect(pair.right).toMatchObject({ $type: 'Leaf', name: 'b' });
        expect(pair.right.size).toBeUndefined();
        expect(leaf).toMatchObject({ $type: 'Leaf', name: 'c', size: 2, color: 'blue' });
        expect(model.$cstNode.text).toBe(input);
    });
});
