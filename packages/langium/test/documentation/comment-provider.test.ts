/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { parseHelper } from 'langium/test';
import { AstUtils, EmptyFileSystem, GrammarAST } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';

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
        AstUtils.streamAst(ast).filter(GrammarAST.isAbstractRule).forEach(rule => {
            const comment = services.documentation.CommentProvider.getComment(rule);
            expect(comment).toBe(`/** ${rule.name} */`);
        });
    });
});
