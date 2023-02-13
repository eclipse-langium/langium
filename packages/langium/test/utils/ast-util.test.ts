/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { createLangiumGrammarServices, EmptyFileSystem, streamAst } from '../../src';
import { isParserRule } from '../../src/grammar/generated/ast';

describe('AST Utils', () => {

    test('Streaming ast works with range', () => {
        const services = createLangiumGrammarServices(EmptyFileSystem);
        const parseResult = services.grammar.parser.LangiumParser.parse(`Before: 'before';
        OverlapBefore:
            'before';
        Inside: 'inside';
        OverlapAfter:
            'after';
        After: 'after';
        `);
        const options = {
            range: {
                start: {
                    line: 2,
                    character: 0
                },
                end: {
                    line: 5,
                    character: 0
                }
            }
        };
        const names: string[] = [];
        for (const node of streamAst(parseResult.value, options)) {
            if (isParserRule(node)) {
                names.push(node.name);
            }
        }
        expect(names).toEqual(['OverlapBefore', 'Inside', 'OverlapAfter']);
    });

});