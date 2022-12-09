/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices, EmptyFileSystem, Grammar } from 'langium';
import { parseHelper } from 'langium/test';
import { generateTypesFile } from '../../src/generator/types-generator';

const { grammar } = createLangiumGrammarServices(EmptyFileSystem);

describe('Types generator', () => {

    test('should generate types file', async () => {
        const result = (await parseHelper<Grammar>(grammar)(TEST_GRAMMAR)).parseResult;
        // on Windows system the line ending of result is "\r\n"
        // Therefore typesFileContent is normalized to prevent false negatives
        const typesFileContent = generateTypesFile(grammar, [result.value]).replace(/\r/g, '');
        expect(typesFileContent).toMatch(EXPECTED_TYPES);
    });

});

const EXPECTED_TYPES =
    `type AbstractDefinition = DeclaredParameter | Definition;

type Expression = BinaryExpression | FunctionCall | NumberLiteral;

type Statement = Definition | Evaluation;

interface BinaryExpression {
    left: Expression
    operator: '*' | '+' | '-' | '/'
    right: Expression
}

interface DeclaredParameter {
    name: string
}

interface Definition {
    name: string
    args: DeclaredParameter[]
    expr: Expression
}

interface Evaluation {
    expression: Expression
}

interface FunctionCall {
    func: @AbstractDefinition
    args: Expression[]
}

interface Module {
    name: string
    statements: Statement[]
}

interface NumberLiteral {
    value: number
}

`;

const TEST_GRAMMAR =
    `
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
