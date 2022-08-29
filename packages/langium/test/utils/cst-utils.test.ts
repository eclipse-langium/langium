/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { createLangiumGrammarServices, EmptyFileSystem, Grammar } from '../../src';
import { parseHelper } from '../../src/test';
import * as c from '../../src/utils/cst-util';

const services = createLangiumGrammarServices(EmptyFileSystem);
const parser = parseHelper<Grammar>(services.grammar);

describe('CST Utils', () => {

    test('Find Leaf Node at Offset', async () => {
        const text = `
        grammar test
        Main: value=AB;
        terminal fragment Frag: 'B';
        terminal AB: 'A' Frag;
        `;

        const grammar = await parser(text);
        const testOffset = grammar.parseResult.value.$document?.textDocument.getText().indexOf('AB');
        const leafnode = c.findLeafNodeAtOffset(grammar.parseResult.value.$cstNode!, testOffset!);
        console.log(leafnode);
        console.log(testOffset);
        console.log(grammar);
        expect(leafnode!.text).toBe('AB');
    });
});