/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable */

import { createServicesForGrammar, GrammarAST } from 'langium';
import { getPropertyDescriptions, getValueDescriptions, toValueDescriptionMap, ValueDescription } from '../src/descriptions';
import { matchDescriptions } from '../src/matching';
import { SerializationCache } from '../src/serialization-cache';
import { selectNodeCandidates, selectNodeStart } from '../src/candidate-selector';

test('x', () => {

    const grammarText = `
    grammar MathTest

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

    hidden terminal WS: /\s+/;
    terminal ID: /[_a-zA-Z][\w_]*/;
    terminal NUMBER returns number: /[0-9]+(\.[0-9]*)?/;

    hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
    hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
    `;

    const services = createServicesForGrammar({
        grammar: grammarText
    });

    const grammar = services.Grammar;
    const reflection = services.shared.AstReflection;
    const cache = new SerializationCache();
    const context = {
        cache, reflection
    };
    const rule = grammar.rules[7] as GrammarAST.ParserRule;
    const descriptions = getPropertyDescriptions(context, rule.definition);
    expect(descriptions).toBeDefined();

    // const testValues: ValueDescription[] = [{
    //     property: 'value',
    //     value: 'X'
    // }];
    // const map = toValueDescriptionMap(testValues);
    // const matches = matchDescriptions(context, map, descriptions!);
    // expect(matches).toBeTruthy();

    const node: any = {
        $type: 'BinaryExpression',
        left: { $type: 'NumberLiteral' },
        right: { $type: 'NumberLiteral' },
        operator: '*'
    };
    const candidates = selectNodeCandidates(context, node.$type, rule);
    expect(candidates).toBeDefined();
    const selected = selectNodeStart(context, getValueDescriptions(node), candidates);
    expect(selected).toBeDefined();
});