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

    test('GBNF - Simple grammar', async () => {
        const result = await parseGrammar(TEST_GRAMMAR);
        const generated = generateBnf([result.value]);
        expect(generated).toBe(EXPECTED_BNF);
    });

    test('GBNF - Fragment, comment generation', async () => {
        const result = await parseGrammar(GRAMMAR_WITH_FRAGMENT);
        const generated = generateBnf([result.value]);
        const expected = expandToStringWithNL`
        # * This is a root rule
        root ::= package-declaration*

        # * This is a package declaration * Using parser rule fragment
        package-declaration ::= hidden* "package" named-element hidden* "{" hidden* "}"

        named-element ::= qualified-name

        qualified-name ::= id ( hidden* "." id )*

        # * Terminal fragment
        number ::= hidden* [0-9]+

        # * Terminal using fragment
        signed-number ::= hidden* [+-] number+

        # Terminal rule
        id ::= hidden* [A-z]*

        ws ::= \\s+

        hidden ::= ( ws )
        `;
        expect(generated).toBe(expected);
    });

    test('EBNF - Fragment, comment generation', async () => {
        const result = await parseGrammar(GRAMMAR_WITH_FRAGMENT);
        const generated = generateBnf([result.value], { dialect: 'EBNF' });
        const expected = expandToStringWithNL`
        (* * This is a root rule *)
        <Domainmodel> ::= <PackageDeclaration>*

        (* * This is a package declaration * Using parser rule fragment *)
        <PackageDeclaration> ::= <HIDDEN>* "package" <NamedElement> <HIDDEN>* "{" <HIDDEN>* "}"

        <NamedElement> ::= <QualifiedName>

        <QualifiedName> ::= <ID> ( <HIDDEN>* "." <ID> )*

        (* * Terminal fragment *)
        <NUMBER> ::= <HIDDEN>* [0-9]+

        (* * Terminal using fragment *)
        <SIGNED_NUMBER> ::= <HIDDEN>* [+-] <NUMBER>+

        (* Terminal rule *)
        <ID> ::= <HIDDEN>* [A-z]*

        <WS> ::= \\s+

        <HIDDEN> ::= ( <WS> )
        `;
        expect(generated).toBe(expected);
    });

    test('GBNF - No hidden rules', async () => {
        const grammarContent = expandToStringWithNL`
        grammar RootLang
        entry Root:
            'root' name=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `;

        const result = await parseGrammar(grammarContent);
        const generated = generateBnf([result.value]);
        const expected = expandToStringWithNL`
        root ::= "root" id

        id ::= [_a-zA-Z][\\w_]*

        `;
        expect(generated).toBe(expected);
    });
    test('GBNF - No hidden rules', async () => {
        const grammarContent = expandToStringWithNL`
        grammar RootLang
        entry Root:
            'root' name=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `;

        const result = await parseGrammar(grammarContent);
        const generated = generateBnf([result.value]);
        const expected = expandToStringWithNL`
        root ::= "root" id

        id ::= [_a-zA-Z][\\w_]*

        `;
        expect(generated).toBe(expected);
    });

    test('EBNF - Slash comments', async () => {
        const grammarContent = expandToStringWithNL`
        grammar RootLang
        /* This is a root rule */
        entry Root: 'root' name=ID;
        
        /* This is a terminal rule */
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `;

        const result = await parseGrammar(grammarContent);
        const generated = generateBnf([result.value], { dialect: 'EBNF', commentStyle: 'slash' });
        const expected = expandToStringWithNL`
        /* This is a root rule */
        <Root> ::= "root" <ID>

        /* This is a terminal rule */
        <ID> ::= [_a-zA-Z][\\w_]*

        `;
        expect(generated).toBe(expected);
    });

    test('Check RegEx Terminal rule escape', async () => {
        const grammarContent = expandToStringWithNL`
        grammar RootLang
        entry Root: 'root' name=ID;

        terminal ID: /[_a-zA-Z][\\w_]*/;
        
        terminal NUMBER: /[0-9]+/ | /[0-9]+(\\.[0-9]*)/;
        
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
        `;

        const result = await parseGrammar(grammarContent);
        const generated = generateBnf([result.value]);
        const expected = expandToStringWithNL`
        root ::= hidden* "root" id

        id ::= hidden* [_a-zA-Z][\\w_]*

        number ::= hidden* ([0-9]+ | [0-9]+(\\.[0-9]*))

        ml-comment ::= /\\*[\\s\\S]*?\\*/

        sl-comment ::= //[^\\n\\r]*

        hidden ::= ( ml-comment | sl-comment )
        `;
        expect(generated).toBe(expected);
    });

    test('Parser Rule parameter', async () => {
        const grammarContent = expandToStringWithNL`
        grammar Test
        entry Model:
            element1=Element<false, false>
            element2=Element<false, true>
            element3=Element<true, false>
            element4=Element<true, true>
        ;
        Element<a,b>:
            (<a> "a")
            (<!a> "!a")
            (<a&b> "ab")
            (<a|b> "a_b")
            (<!(a&b)> '!ab')
            (<a> "a" | <b> "b")
            name="name"
            elements+=Element<false | a, b & true>*
        ';';
        `;

        const result = await parseGrammar(grammarContent);
        const generated = generateBnf([result.value]);
        const expected = expandToStringWithNL`
        root ::= element element-b element-a element-ab

        element ::= "!a" "!ab" "name" element* ";"
        element-a ::= "a" "a_b" "!ab" ("a") "name" element-a* ";"
        element-b ::= "!a" "a_b" "!ab" ("b") "name" element-b* ";"
        element-ab ::= "a" "ab" "a_b" ("a" | "b") "name" element-ab* ";"

        `;
        expect(generated).toBe(expected);
    });

});

const EXPECTED_BNF = expandToStringWithNL`
root ::= hidden* "module" id statement*

statement ::= (definition | evaluation)

definition ::= hidden* "def" id ( hidden* "(" declared-parameter ( hidden* "," declared-parameter )* hidden* ")" )? hidden* ":" expression hidden* ";"

declared-parameter ::= id

evaluation ::= expression hidden* ";"

expression ::= addition

addition ::= multiplication ( (hidden* "+" | hidden* "-") multiplication )*

multiplication ::= primary-expression ( (hidden* "*" | hidden* "/") primary-expression )*

primary-expression ::= (hidden* "(" expression hidden* ")" | number | ID ( hidden* "(" expression ( hidden* "," expression )* hidden* ")" )?)

ws ::= \\s+

id ::= hidden* [_a-zA-Z][\\w_]*

number ::= hidden* [0-9]+(\\.[0-9]*)?

ml-comment ::= /\\*[\\s\\S]*?\\*/

sl-comment ::= //[^\\n\\r]*

hidden ::= ( ws | ml-comment | sl-comment )
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

const GRAMMAR_WITH_FRAGMENT = expandToStringWithNL`
    grammar DomainModel
    /** This is a root rule */
    entry Domainmodel:
        (elements+=PackageDeclaration)*;

    /*
    * This is a package declaration
    * Using parser rule fragment
    */
    PackageDeclaration:
        'package' NamedElement '{'
        '}';

    fragment NamedElement:
        name=QualifiedName
    ;

    // Datatype rule
    QualifiedName returns string:
        ID ('.' ID)*;

    /** Terminal fragment */
    terminal fragment NUMBER: /[0-9]+/;
    /** Terminal using fragment */
    terminal SIGNED_NUMBER returns number: /[+-]/ NUMBER+;
    /* Terminal rule */
    terminal ID: /[A-z]*/;
    hidden terminal WS: /\\s+/;
`;

async function parseGrammar(grammarContent: string) {
    const result = (await parseHelper<Grammar>(grammar)(grammarContent)).parseResult;
    expect(result.lexerErrors.length, `Grammar contains ${result.lexerErrors.length} lexer error/-s: ${result.lexerErrors[0]?.message}`)
        .toBe(0);
    return result;
}

