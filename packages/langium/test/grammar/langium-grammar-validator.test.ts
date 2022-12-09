/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, createLangiumGrammarServices, EmptyFileSystem, Properties, streamAllContents, GrammarAST } from '../../src';
import { expectError, expectIssue, expectNoIssues, expectWarning, validationHelper, ValidationResult } from '../../src/test';
import { IssueCodes } from '../../src/grammar/langium-grammar-validator';
import { DiagnosticSeverity } from 'vscode-languageserver';

const services = createLangiumGrammarServices(EmptyFileSystem);
const locator = services.grammar.workspace.AstNodeLocator;
const validate = validationHelper<GrammarAST.Grammar>(services.grammar);

describe('Langium grammar validation', () => {

    // TODO: needs to be reimplemented once the type system has been refactored
    // test('Declared interfaces warn when extending inferred interfaces', async () => {
    //     const validationResult = await validate(`
    //     InferredT: prop=ID;

    //     interface DeclaredExtendsInferred extends InferredT {}`);

    //     // should get a warning when basing declared types on inferred types
    //     expectWarning(validationResult, /Extending an interface by a parser rule gives an ambiguous type, instead of the expected declared type./, {
    //         node: validationResult.document.parseResult.value.interfaces[0],
    //         property: {name: 'superTypes'}
    //     });
    // });

    test('Parser rule should not assign fragments', async () => {
        // arrange
        const grammarText = `
        grammar Test
        entry A: b=B;
        fragment B: name=ID;
        terminal ID returns string: /[a-z]+/;
        `;

        // act
        const validationResult = await validate(grammarText);

        // assert
        expectError(validationResult, /Cannot use fragment rule 'B' for assignment of property 'b'./, {
            node: (validationResult.document.parseResult.value.rules[0] as GrammarAST.ParserRule).definition as GrammarAST.Assignment,
            property: {name: 'terminal'}
        });
    });

    // TODO: needs to be reimplemented once the type system has been refactored
    // test('Declared interfaces cannot extend inferred unions directly', async () => {
    //     const validationResult = await validate(`
    //     InferredUnion: InferredI1 | InferredI2;

    //     InferredI1: prop1=ID;
    //     InferredI2: prop2=ID;

    //     interface DeclaredExtendsUnion extends InferredUnion {}
    //     `);

    //     // should get an error on DeclaredExtendsUnion, since it cannot extend an inferred union
    //     expectError(validationResult, /An interface cannot extend a union type, which was inferred from parser rule InferredUnion./, {
    //         node: validationResult.document.parseResult.value.interfaces[0],
    //         property: {name: 'superTypes'}
    //     });
    // });

    // TODO: needs to be reimplemented once the type system has been refactored
    // test('Declared interfaces cannot extend inferred unions via indirect inheritance', async () => {

    //     const validationResult = await validate(`
    //     InferredUnion: InferredI1 | InferredI2;

    //     InferredI1: prop1=ID;
    //     InferredI2: prop2=ID;

    //     Intermediary: InferredUnion;

    //     interface DeclaredExtendsInferred extends Intermediary {}
    //     `);

    //     // same error, but being sure that this holds when an inferred type extends another inferred type
    //     expectError(validationResult, /An interface cannot extend a union type, which was inferred from parser rule Intermediary./, {
    //         node: validationResult.document.parseResult.value.interfaces[0],
    //         property: {name: 'superTypes'}
    //     });
    // });

    test('Actions cannot redefine declared types', async () => {
        const validationResult = await validate(`
        grammar G
        interface A {
            val: string
        }
        entry X: 'x' {A} val=ID;
        Y: 'y' {infer A} q='broken';
        `);
        expectError(validationResult, /A is a declared type and cannot be redefined./, {
            range: {
                start: {character: 15, line: 6},
                end: {character: 24, line: 6}
            },
            code: IssueCodes.SuperfluousInfer
        });
    });
});

describe('checkReferenceToRuleButNotType', () => {

    const input = `
        grammar CrossRefs

        entry Model:
            'model' name=ID
            (elements+=Element)*;

        type AbstractElement = Reference | string;

        Element:
            Definition | Reference;

        Definition infers DefType:
            name=ID;
        Reference infers RefType:
            ref=[Definition];
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<GrammarAST.Grammar>;

    beforeAll(async () => {
        validationResult = await validate(input);
    });

    test('CrossReference validation', () => {
        const crossRef = streamAllContents(validationResult.document.parseResult.value).find(GrammarAST.isCrossReference)!;
        expectError(validationResult, "Could not resolve reference to AbstractType named 'Definition'.", {
            node: crossRef,
            property: { name: 'type' }
        });
    });

    test('AtomType validation', () => {
        const type = validationResult.document.parseResult.value.types[0];
        expectError(validationResult, "Could not resolve reference to AbstractType named 'Reference'.", {
            node: type,
            property: { name: 'typeAlternatives' }
        });
    });

});

describe('Check Rule Fragment Validation', () => {
    const grammar = `
    grammar g
    type Type = Fragment;
    fragment Fragment: name=ID;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<GrammarAST.Grammar>;

    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('Rule Fragment Validation', () => {
        const range = { start: { character: 16, line: 1 }, end: { character: 24, line: 1 } };
        expectError(validationResult, 'Cannot use rule fragments in types.', { range });
    });
});

describe('Checked Named CrossRefs', () => {
    const input = `
    grammar g
    A: 'a' name=ID;
    B: 'b' name=[A];
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<GrammarAST.Grammar>;

    beforeAll(async () => {
        validationResult = await validate(input);
    });

    test('Named crossReference warning', () => {
        const rule = ((validationResult.document.parseResult.value.rules[1] as GrammarAST.ParserRule).definition as GrammarAST.Group).elements[1] as GrammarAST.Assignment;
        expectWarning(validationResult, 'The "name" property is not recommended for cross-references.', {
            node: rule,
            property: { name: 'feature' }
        });
    });
});

describe('Check grammar with primitives', () => {
    const grammar = `
    grammar PrimGrammar
    entry Expr:
        (Word | Bool | Num | LargeInt | DateObj)*;
    Word:
        'Word' val=STR;
    Bool:
        'Bool' val?='true';
    Num:
        'Num' val=NUM;
    LargeInt:
        'LargeInt' val=BIG 'n';
    DateObj:
        'Date' val=DATE;
    terminal STR: /[_a-zA-Z][\\w_]*/;
    terminal BIG returns bigint: /[0-9]+(?=n)/;
    terminal NUM returns number: /[0-9]+(\\.[0-9])?/;
    terminal DATE returns Date: /[0-9]{4}-{0-9}2-{0-9}2/+;
    `.trim();

    let validationResult: ValidationResult<GrammarAST.Grammar>;

    // 1. build a parser from this grammar, verify it works
    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('No validation errors in grammar', () => {
        expectNoIssues(validationResult);
    });
});

describe('Unordered group validations', () => {

    test('Unsupported optional element in unordered group error', async () => {
        const text = `
        grammar TestUnorderedGroup

        entry Book:
            'book' name=STRING
            (
                  ("description" descr=STRING)
                & ("edition" version=STRING)?
                & ("author" author=STRING)
            )
        ;
        hidden terminal WS: /\\s+/;
        terminal STRING: /"[^"]*"|'[^']*'/;
        `;

        const validation = await validate(text);
        expect(validation.diagnostics).toHaveLength(1);
        const errorText = '("edition" version=STRING)?';
        const offset = validation.document.textDocument.getText().indexOf(errorText);
        expectError(validation, 'Optional elements in Unordered groups are currently not supported', { offset: offset, length: errorText.length, code: IssueCodes.OptionalUnorderedGroup } );
    });
});

describe('Unused rules validation', () => {

    test('Should not create validate for indirectly used terminal', async () => {
        const text = `
        grammar TestUsedTerminals

        entry Used: name=ID;
        hidden terminal WS: /\\s+/;
        terminal ID: 'a' STRING;
        terminal STRING: /"[^"]*"|'[^']*'/;
        `;
        const validation = await validate(text);
        expectNoIssues(validation);
    });

    test('Unused terminals are correctly identified', async () => {
        const text = `
        grammar TestUnusedTerminals

        entry Used: name=ID;
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        terminal STRING: /"[^"]*"|'[^']*'/;
        `;
        const validation = await validate(text);
        expect(validation.diagnostics).toHaveLength(1);
        const stringTerminal = validation.document.parseResult.value.rules.find(e => e.name === 'STRING')!;
        expectIssue(validation, {
            node: stringTerminal,
            property: {
                name: 'name'
            },
            severity: DiagnosticSeverity.Hint
        });
    });

    test('Unused parser rules are correctly identified', async () => {
        const text = `
        grammar TestUnusedParserRule

        entry Used: name=ID;
        Unused: name=ID;
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const validation = await validate(text);
        expect(validation.diagnostics).toHaveLength(1);
        const unusedRule = validation.document.parseResult.value.rules.find(e => e.name === 'Unused')!;
        expectIssue(validation, {
            node: unusedRule,
            property: {
                name: 'name'
            },
            severity: DiagnosticSeverity.Hint
        });
    });

});

describe('Reserved names', () => {

    test('Reserved parser rule name', async () => {
        const text = 'String: name="X";';
        expectReservedName(await validate(text), GrammarAST.isParserRule, 'name');
    });

    test('Reserved terminal rule name - negative', async () => {
        const text = 'terminal String: /X/;';
        const validation = await validate(text);
        expect(validation.diagnostics).toHaveLength(0);
    });

    test('Reserved rule inferred type', async () => {
        const text = 'X infers String: name="X";';
        expectReservedName(await validate(text), GrammarAST.isInferredType, 'name');
    });

    test('Reserved assignment feature', async () => {
        const text = 'X: Map="X";';
        expectReservedName(await validate(text), GrammarAST.isAssignment, 'feature');
    });

    test('Reserved action type', async () => {
        const text = 'X: {infer String} name="X";';
        expectReservedName(await validate(text), GrammarAST.isInferredType, 'name');
    });

    test('Reserved action feature', async () => {
        const text = 'X: Y {infer Z.Map=current} name="X"; Y: name="Y";';
        expectReservedName(await validate(text), GrammarAST.isAction, 'feature');
    });

    test('Reserved interface name', async () => {
        const text = 'interface String {}';
        expectReservedName(await validate(text), GrammarAST.isInterface, 'name');
    });

    test('Reserved interface name - negative', async () => {
        const text = 'interface obj {}';
        const validation = await validate(text);
        expect(validation.diagnostics).toHaveLength(0);
    });

    test('Reserved type attribute name', async () => {
        const text = 'interface X { Map: number }';
        expectReservedName(await validate(text), GrammarAST.isTypeAttribute, 'name');
    });

    test('Reserved type name', async () => {
        const text = 'type String = X; X: name="X";';
        expectReservedName(await validate(text), GrammarAST.isType, 'name');
    });

    function expectReservedName<T extends AstNode>(validation: ValidationResult<GrammarAST.Grammar>, predicate: (node: AstNode) => node is T, property: Properties<T>): void {
        expect(validation.diagnostics).toHaveLength(1);
        const node = streamAllContents(validation.document.parseResult.value).find(predicate)!;
        expectIssue(validation, {
            node,
            message: / is a reserved name of the JavaScript runtime\.$/,
            property: {
                name: property
            },
            severity: DiagnosticSeverity.Error
        });
    }

});

describe('Whitespace keywords', () => {

    const grammar = `
    ParserRule: name='x' ' ' '' 'x y';
    terminal TerminalRule: ' ' | 'x'; 
    terminal STR: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<GrammarAST.Grammar>;

    // 1. build a parser from this grammar, verify it works
    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('No validation errors for whitespace keywords in terminal rule', () => {
        const node = locator.getAstNode<GrammarAST.Keyword>(
            validationResult.document.parseResult.value,
            'rules@1/definition/elements@1'
        )!;
        expectNoIssues(validationResult, { node });
    });

    test('Should error for whitespace keyword in parser rule', () => {
        const node = locator.getAstNode<GrammarAST.Keyword>(
            validationResult.document.parseResult.value,
            'rules@0/definition/elements@1'
        )!;
        expectError(validationResult, 'Keywords cannot only consist of whitespace characters.', { node });
    });

    test('Should error for empty keyword in parser rule', () => {
        const node = locator.getAstNode<GrammarAST.Keyword>(
            validationResult.document.parseResult.value,
            'rules@0/definition/elements@2'
        )!;
        expectError(validationResult, 'Keywords cannot be empty.', { node });
    });

    test('Should warn for keywords with whitespaces in parser rule', () => {
        const node = locator.getAstNode<GrammarAST.Keyword>(
            validationResult.document.parseResult.value,
            'rules@0/definition/elements@3'
        )!;
        expectWarning(validationResult, 'Keywords should not contain whitespace characters.', { node });
    });

});
