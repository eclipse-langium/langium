/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { AstUtils, EmptyFileSystem, GrammarAST } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';

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
        for (const node of AstUtils.streamAst(parseResult.value, options)) {
            if (GrammarAST.isParserRule(node)) {
                names.push(node.name);
            }
        }
        expect(names).toEqual(['OverlapBefore', 'Inside', 'OverlapAfter']);
    });

});
