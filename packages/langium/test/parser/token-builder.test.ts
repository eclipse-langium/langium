/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TokenType } from '@chevrotain/types';
import { createLangiumGrammarServices, Grammar } from '../../src';
import {  parseHelper } from '../../src/test';

const services = createLangiumGrammarServices();
const tokenBuilder = services.parser.TokenBuilder;

const text = `
grammar test

Main: {Main} 'A' 'AB' 'ABC';
terminal AB: /ABD?/;
`;
const grammar = parseHelper<Grammar>(services)(text).parseResult.value;

const tokens = tokenBuilder.buildTokens(grammar);
const aToken = tokens[2]; // 'A' keyword
const abToken = tokens[1]; // 'AB' keyword
const abcToken = tokens[0]; // 'ABC' keyword
const abTerminalToken = tokens[3]; // 'AB' terminal

describe('tokenBuilder#longerAlts', () => {

    test('should create longer alts for keywords # 1', () => {
        expect(Array.isArray(aToken.LONGER_ALT)).toBeTruthy();
        const longerAlts = aToken.LONGER_ALT as TokenType[];
        expect(longerAlts).toEqual([abcToken, abToken, abTerminalToken]);
    });

    test('should create longer alts for keywords # 2', () => {
        expect(Array.isArray(abToken.LONGER_ALT)).toBeTruthy();
        const longerAlts = abToken.LONGER_ALT as TokenType[];
        expect(longerAlts).toEqual([abcToken, abTerminalToken]);
    });

    test('should create no longer alts for longest keyword', () => {
        expect(abcToken.LONGER_ALT).toEqual([]);
    });

    test('should create no longer alts for terminals', () => {
        expect(abTerminalToken.LONGER_ALT).toBeUndefined();
    });

});
