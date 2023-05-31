/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { DefaultTokenBuilder, createServicesForGrammar } from '../../src';
import { fail } from 'assert';
import type { IToken, TokenType } from 'chevrotain';
import type { GenericAstNode, CustomPayloadResolver, GrammarAST } from '../../src';

describe('CustomPayloadResolver', () => {

    test('Can resolve custom token payload', async () => {

        class TestTokenBuilder extends DefaultTokenBuilder {
            protected override buildTerminalToken(terminal: GrammarAST.TerminalRule): TokenType {
                if (terminal.name === 'Payload') {
                    return {
                        name: 'Payload',
                        PATTERN: () => {
                            const result: [string] = ['value'];
                            Object.assign(result, { payload: 'test' });
                            return result;
                        },
                        LINE_BREAKS: false
                    };
                } else {
                    return super.buildTerminalToken(terminal);
                }
            }
        }

        class TestCustomPayloadResolver implements CustomPayloadResolver {
            resolveTokenPayload(token: IToken): string {
                if (token.payload === undefined) {
                    fail('No token payload found');
                }
                return token.payload as string;
            }
        }

        const services = await createServicesForGrammar({
            grammar: `
            grammar Test

            entry Model: value=Payload;

            terminal Payload: /\\w+/;

            hidden terminal WS: /\\s+/;
            `,
            module: {
                parser: {
                    TokenBuilder: () => new TestTokenBuilder(),
                    CustomPayloadResolver: () => new TestCustomPayloadResolver()
                }
            }
        });

        const parser = services.parser.LangiumParser;

        const parseResult = parser.parse('value');
        const model = parseResult.value as GenericAstNode;
        expect(model.value).toBe('test');
    });

});
