/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { parseHelper } from '../../src/test';
import { EmptyFileSystem, createLangiumGrammarServices, streamAst } from '../../src';
import { isAbstractRule } from '../../src/grammar/generated/ast';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper(services);

describe('Comment provider', () => {
    test('Get a comment', async () => {
        const ast = (await parse(`
            grammar Test
            /** Rule */
            entry Rule: 'rule' num=INT;
            /** INT */
            terminal INT: /\\d+/;
        `)).parseResult.value;

        const grammarComment = services.documentation.CommentProvider.getComment(ast);
        expect(grammarComment).toBeUndefined();
        streamAst(ast).filter(isAbstractRule).forEach(rule => {
            const comment = services.documentation.CommentProvider.getComment(rule);
            expect(comment).toBe(`/** ${rule.name} */`);
        });
        expect(ast).toBeDefined();
    });
});
