/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { TokenType } from '@chevrotain/types';
import type { AstNode, Grammar, LangiumParser, Lexer, Module } from 'langium';
import { beforeEach, describe, expect, test } from 'vitest';
import { EmptyFileSystem, IndentationAwareLexer, IndentationAwareTokenBuilder } from 'langium';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';
import type { LangiumServices, PartialLangiumServices } from 'langium/lsp';
import { expandToString } from 'langium/generate';
import { parseHelper } from 'langium/test';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const helper = parseHelper<Grammar>(grammarServices);

const tokenBuilder = new IndentationAwareTokenBuilder();

async function getTokens(grammarString: string): Promise<TokenType[]> {
    const grammar = (await helper(grammarString)).parseResult.value;
    return tokenBuilder.buildTokens(grammar) as TokenType[];
}

async function getLexer(grammar: string): Promise<Lexer> {
    const services = await createIndentationAwareServices(grammar);
    return services.parser.Lexer;
}

async function getParser(grammar: string): Promise<LangiumParser> {
    const services = await createIndentationAwareServices(grammar);
    return services.parser.LangiumParser;
}

async function createIndentationAwareServices(grammar: string): Promise<LangiumServices> {
    const services = await createServicesForGrammar({
        grammar,
        module: {
            parser: {
                TokenBuilder: () => new IndentationAwareTokenBuilder(),
                Lexer: services => new IndentationAwareLexer(services)
            }
        } satisfies Module<LangiumServices, PartialLangiumServices>
    });
    return services;
}

beforeEach(() => {
    tokenBuilder.popRemainingDedents('');
});

describe('IndentationAwareTokenBuilder', () => {

    const sampleGrammar = `
        entry Main:
            INDENT name=ID DEDENT;

        terminal ID: /[a-zA-Z_]\\w*/;
        hidden terminal NL: /[\\r\\n]+/;
        hidden terminal WS: /[\\t ]+/;
        terminal INDENT: 'synthetic:indent';
        terminal DEDENT: 'synthetic:dedent';
    `;

    test('Moves indent/dedent token types to the beginning', async () => {
        const tokenTypes = await getTokens(sampleGrammar);

        expect(tokenTypes).toHaveLength(5);

        const [dedent, indent, ws] = tokenTypes;
        expect(dedent.name).toBe('DEDENT');
        expect(indent.name).toBe('INDENT');
        expect(ws.name).toBe('WS');
    });

    test('Modifies indent/dedent patterns to be functions', async () => {
        const tokenTypes = await getTokens(sampleGrammar);

        expect(tokenTypes).toHaveLength(5);

        const [dedent, indent] = tokenTypes;
        expect(dedent.PATTERN).toBeTypeOf('function');
        expect(indent.PATTERN).toBeTypeOf('function');
    });

    test('Rejects grammar without indent', async () => {
        const indentlessGrammar = `
        entry Main: name=ID;

        terminal ID: /[a-zA-Z_]\\w*/;
        hidden terminal WS: /\\s+/;
        terminal DEDENT: 'synthetic:dedent';
        `;

        await expect(getTokens(indentlessGrammar)).rejects.toThrowError();
    });

    test('Rejects grammar without dedent', async () => {
        const dedentlessGrammar = `
        entry Main: name=ID;

        terminal ID: /[a-zA-Z_]\\w*/;
        hidden terminal WS: /\\s+/;
        terminal INDENT: 'synthetic:indent';
        `;

        await expect(getTokens(dedentlessGrammar)).rejects.toThrowError();
    });

    test('Rejects grammar without whitespace', async () => {
        const spacelessGrammar = `
        entry Main: name=ID;

        terminal ID: /[a-zA-Z_]\\w*/;
        terminal INDENT: 'synthetic:indent';
        terminal DEDENT: 'synthetic:dedent';
        `;

        await expect(getTokens(spacelessGrammar)).rejects.toThrowError();
    });

});

describe('IndentationAwareLexer', () => {

    const sampleGrammar = `
        grammar Test

        entry Block: '{' INDENT names+=ID* DEDENT nested+=Block* '}';

        terminal ID: /[a-zA-Z_]\\w*/;
        hidden terminal NL: /[\\r\\n]+/;
        hidden terminal WS: /[\\t ]+/;
        terminal INDENT: 'synthetic:indent';
        terminal DEDENT: 'synthetic:dedent';
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
    `;

    test('should emit indent/dedent tokens around a block', async () => {
        const lexer = await getLexer(sampleGrammar);
        const { tokens, errors } = lexer.tokenize(expandToString`
        {
            name
            anotherName
        }`);

        expect(errors).toHaveLength(0);
        expect(tokens).toHaveLength(6);

        const [/* L_BRAC */, indent, /* id1 */, /* id2 */, dedent, /* _R_BRAC */] = tokens;
        expect(indent.tokenType.name).toBe('INDENT');
        expect(dedent.tokenType.name).toBe('DEDENT');
    });

    test('should ignore indent tokens before comments', async () => {
        const lexer = await getLexer(sampleGrammar);
        const { tokens, errors } = lexer.tokenize(expandToString`
        // single-line comment
            // indented comment when not expecting indentation
        {
            name
                // comment with different indentation inside block
            anotherName
        }`);

        expect(errors).toHaveLength(0);
        expect(tokens).toHaveLength(6);
    });

    test('should not dedect indentation without a newline', async () => {
        const lexer = await getLexer(sampleGrammar);
        const { tokens } = lexer.tokenize(expandToString`
        { name
            // indented comment - to be ignored
        }`);
        expect(tokens).toHaveLength(3);
        expect(tokens[1]).not.toBe('INDENT');
    });

    test('should add remaining dedents to the end', async () => {
        const lexer = await getLexer(sampleGrammar);
        const { tokens } = lexer.tokenize(expandToString`
        // single-line comment
        {
            name`);
        expect(tokens).toHaveLength(4);

        const [/* L_BRAC */, indent, /* id */, dedent] = tokens;
        expect(indent.tokenType.name).toBe('INDENT');
        expect(dedent.tokenType.name).toBe('DEDENT');
    });

});

describe('IndentationAware parsing', () => {

    const sampleGrammar = `
        grammar PythonIf

        entry Statement: If | Return;

        If:
            'if' condition=BOOLEAN ':'
            INDENT thenBlock+=Statement+ DEDENT
            ('else' ':' INDENT elseBlock+=Statement+ DEDENT)?;

        Return: 'return' value=BOOLEAN;

        terminal BOOLEAN returns boolean: /true|false/;
        terminal INDENT: 'synthetic:indent';
        terminal DEDENT: 'synthetic:dedent';
        hidden terminal NL: /[\\r\\n]+/;
        hidden terminal WS: /[\\t ]+/;
    `;

    test('should parse correctly indented code', async () => {
        const parser = await getParser(sampleGrammar);
        const { parserErrors } = parser.parse(expandToString`
        if true:
            return false
        else:
            return true
        `);

        expect(parserErrors).toHaveLength(0);
    });

    test('should error on non-matching dedent', async () => {
        const parser = await getParser(sampleGrammar);
        const { parserErrors } = parser.parse(expandToString`
        if true:
            return false
          else:
            return true
        `);

        expect(parserErrors.length).toBeGreaterThan(0);
    });

    test('should throw an error on unexpected indent', async () => {
        const parser = await getParser(sampleGrammar);
        const { parserErrors } = parser.parse(expandToString`
        // Parsing starts here
                if true:
                    return false
        `);

        expect(parserErrors.length).toBeGreaterThan(0);
    });

    test('should correctly parse nested blocks', async () => {
        const parser = await getParser(sampleGrammar);
        const { parserErrors, value } = parser.parse(expandToString`
        if true:
            return true
        else:
            if false:
                return true
                return false
            return true
        `);

        expect(parserErrors).toHaveLength(0);
        const ifValue = value as If;
        expect(ifValue.thenBlock).toHaveLength(1);
        expect(ifValue.elseBlock).toHaveLength(2);
        const elseBlock = ifValue.elseBlock![0] as If;
        expect(elseBlock.thenBlock).toHaveLength(2);
        const nestedReturn1 = elseBlock.thenBlock[0] as Return;
        expect(nestedReturn1.value).toBe(true);
        const nestedReturn2 = elseBlock.thenBlock[1] as Return;
        expect(nestedReturn2.value).toBe(false);
        const return2 = ifValue.elseBlock![1] as Return;
        expect(return2.value).toBe(true);
    });

});

type Statement = If | Return;

interface If extends AstNode {
    $type: 'If';
    condition: boolean;
    thenBlock: Statement[];
    elseBlock?: Statement[];
}

interface Return extends AstNode {
    $type: 'Return';
    value: boolean;
}
