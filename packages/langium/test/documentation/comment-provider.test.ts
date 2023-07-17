/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { parseHelper } from '../../src/test/index.js';
import { EmptyFileSystem, createLangiumGrammarServices, streamAst } from '../../src/index.js';
import { isAbstractRule } from '../../src/grammar/generated/ast.js';

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

        expect(ast).toBeDefined();
        const grammarComment = services.documentation.CommentProvider.getComment(ast);
        expect(grammarComment).toBeUndefined();
        streamAst(ast).filter(isAbstractRule).forEach(rule => {
            const comment = services.documentation.CommentProvider.getComment(rule);
            expect(comment).toBe(`/** ${rule.name} */`);
        });
    });
});
