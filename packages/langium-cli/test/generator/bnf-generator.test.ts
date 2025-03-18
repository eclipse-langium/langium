/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import { EmptyFileSystem } from 'langium';
import { expandToStringWithNL } from 'langium/generate';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { describe, expect, test } from 'vitest';
import { generateBnf } from '../../src/generator/bnf-generator.js';

const { grammar } = createLangiumGrammarServices(EmptyFileSystem);

describe('BNF generator', () => {

    test('should generate GBNF file', async () => {
        const result = (await parseHelper<Grammar>(grammar)(TEST_GRAMMAR)).parseResult;
        const typesFileContent = generateBnf([result.value]);
        expect(typesFileContent).toBe(EXPECTED_BNF);
    });

});

const EXPECTED_BNF = expandToStringWithNL`
root ::= "module" ID Statement*

Statement ::= (Definition | Evaluation)

Definition ::= "def" ID ("(" DeclaredParameter ("," DeclaredParameter)* ")")? ":" Expression ";"

DeclaredParameter ::= ID

Evaluation ::= Expression ";"

Expression ::= Addition

Addition ::= Multiplication (("+" | "-") Multiplication)*

Multiplication ::= PrimaryExpression (("*" | "/") PrimaryExpression)*

PrimaryExpression ::= ("(" Expression ")" | NUMBER | ID ("(" Expression ("," Expression)* ")")?)

WS ::= \\s+

ID ::= [_a-zA-Z][\\w_]*

NUMBER ::= [0-9]+(\\.[0-9]*)?

ML_COMMENT ::= /\\*[\\s\\S]*?\\*/

SL_COMMENT ::= //[^\\n\\r]*

`;

const TEST_GRAMMAR = expandToStringWithNL`
    grammar Arithmetics

    entry Module:
        'module' name=ID
        (statements+=Statement)*;

    Statement:
        Definition | Evaluation;

    Definition:
        'def' name=ID ('(' args+=DeclaredParameter (',' args+=DeclaredParameter)* ')')?
        ':' expr=Expression ';';

    DeclaredParameter:
        name=ID;

    type AbstractDefinition = Definition | DeclaredParameter;

    Evaluation:
        expression=Expression ';';

    Expression:
        Addition;

    Addition infers Expression:
        Multiplication ({infer BinaryExpression.left=current} operator=('+' | '-') right=Multiplication)*;

    Multiplication infers Expression:
        PrimaryExpression ({infer BinaryExpression.left=current} operator=('*' | '/') right=PrimaryExpression)*;

    PrimaryExpression infers Expression:
        '(' Expression ')' |
        {infer NumberLiteral} value=NUMBER |
        {infer FunctionCall} func=[AbstractDefinition] ('(' args+=Expression (',' args+=Expression)* ')')?;

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    terminal NUMBER returns number: /[0-9]+(\\.[0-9]*)?/;

    hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
    hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
`;
