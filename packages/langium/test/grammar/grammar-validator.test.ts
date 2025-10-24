/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, Grammar, LangiumDocument, Properties } from 'langium';
import { AstUtils, EmptyFileSystem, GrammarAST, URI } from 'langium';
import { expandToString } from 'langium/generate';
import { IssueCodes, createLangiumGrammarServices } from 'langium/grammar';
import type { ValidationResult } from 'langium/test';
import { clearDocuments, expectError, expectIssue, expectNoIssues, expectWarning, parseHelper, validationHelper } from 'langium/test';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { beforeAnotherRule, beforeSinglelternative, beforeTwoAlternatives, beforeWithInfers } from './lsp/grammar-code-actions.test.js';

const services = createLangiumGrammarServices(EmptyFileSystem);
const parse = parseHelper(services.grammar);
const locator = services.grammar.workspace.AstNodeLocator;
const validate = validationHelper<GrammarAST.Grammar>(services.grammar);

beforeEach(() => clearDocuments(services.shared));

describe('Langium grammar validation', () => {

    test('Declared interfaces warn when extending inferred interfaces', async () => {
        const validationResult = await validate(`
        InferredT: prop=ID;

        interface DeclaredExtendsInferred extends InferredT {}`);

        // should get a warning when basing declared types on inferred types
        expectError(validationResult, /Extending an inferred type is discouraged./, {
            node: validationResult.document.parseResult.value.interfaces[0],
            property: 'superTypes'
        });
    });

    test('Parser rule should not assign fragments', async () => {
        // arrange
        const grammarText = `
        grammar Test
        entry A: b=B c=('c' | C);
        fragment B: name=ID;
        fragment C: name=ID;
        terminal ID returns string: /[a-z]+/;
        `;

        // act
        const validationResult = await validate(grammarText);

        // assert
        const assignments = AstUtils.streamAst(validationResult.document.parseResult.value).filter(GrammarAST.isAssignment).toArray();
        expectError(validationResult, /Cannot use fragment rule 'B' for assignment of property 'b'./, {
            node: (assignments[0].terminal as GrammarAST.RuleCall),
            property: 'rule'
        });
        expectError(validationResult, /Cannot use fragment rule 'C' for assignment of property 'c'./, {
            node: (assignments[1].terminal as GrammarAST.Alternatives).elements[1] as GrammarAST.RuleCall,
            property: 'rule'
        });
    });

    test('Declared interfaces cannot extend inferred unions directly', async () => {
        const validationResult = await validate(`
        InferredUnion: InferredI1 | InferredI2;

        InferredI1: prop1=ID;
        InferredI2: prop2=ID;

        interface DeclaredExtendsUnion extends InferredUnion {}

        terminal ID returns string: /[a-z]+/;
        `);

        expectError(validationResult, /Interfaces cannot extend union types./, {
            node: validationResult.document.parseResult.value.interfaces[0],
            property: 'superTypes'
        });
        expectError(validationResult, /Extending an inferred type is discouraged./, {
            node: validationResult.document.parseResult.value.interfaces[0],
            property: 'superTypes'
        });
    });

    test('Declared interfaces cannot extend inferred unions via indirect inheritance', async () => {

        const validationResult = await validate(`
        InferredUnion: InferredI1 | InferredI2;

        InferredI1: prop1=ID;
        InferredI2: prop2=ID;

        Intermediary: InferredUnion;

        interface DeclaredExtendsInferred extends Intermediary {}

        terminal ID returns string: /[a-z]+/;
        `);

        expectError(validationResult, /Interfaces cannot extend union types./, {
            node: validationResult.document.parseResult.value.interfaces[0],
            property: 'superTypes'
        });
        expectError(validationResult, /Extending an inferred type is discouraged./, {
            node: validationResult.document.parseResult.value.interfaces[0],
            property: 'superTypes'
        });
    });

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
                start: { character: 15, line: 6 },
                end: { character: 24, line: 6 }
            },
            data: {
                code: IssueCodes.SuperfluousInfer
            }
        });
    });

    test('Missing return should be added to parser rule', async () => {
        const validationResult = await validate(`
        grammar G
        interface T { a: string }
        entry T: 't' a=ID;
        terminal ID returns string: /[a-z]+/;
        `);
        expectError(validationResult, /The type 'T' is already explicitly declared and cannot be inferred./, {
            node: validationResult.document.parseResult.value.rules[0],
            property: 'name',
            data: {
                code: IssueCodes.MissingReturns
            }
        });
    });

    test('Invalid infers should be changed to returns', async () => {
        const validationResult = await validate(`
        grammar G
        interface T { a: string }
        entry T infers T: 't' a=ID;
        terminal ID returns string: /[a-z]+/;
        `);
        expect(validationResult.diagnostics).toHaveLength(1);
        expect(validationResult.diagnostics[0].data?.code).toBe(IssueCodes.InvalidInfers);
    });

    test('Rule calls with multiplicity have assignment', async () => {
        const grammar = `
        grammar RuleCallMult

        entry List1:
            '(' Mult (',' Mult)* ')' '/' List2 '/' List3 '/' List4;
        List2:
            Plus+;
        List3:
            Exp+;
        List4:
            elems += (Minus | Div);

        Mult: content=ID;
        Plus: content=ID;
        Minus: '-' variable=ID;
        Div: 'div' variable=ID;
        fragment Exp: content+=ID;

        terminal ID: /[_a-zA-Z][\\w_]*/;
        `.trim();

        const validationResult = await validate(grammar);
        expect(validationResult.diagnostics).to.have.length(2);
        expectError(validationResult, "Rule call 'Mult' requires assignment when parsed multiple times.", {
            property: undefined
        });
        expectError(validationResult, "Rule call 'Plus' requires assignment when parsed multiple times.", {
            property: undefined
        });
    });

    test('Rule calls with multiplicity - negative', async () => {
        const grammar = `
        grammar Test

        entry Main:
            // Fragment rule
            Body*
            // Data type rule
            FQN*
            // Terminal rule
            ID*;
        fragment Body:
            value+='test';
        FQN returns string:
            ID ('.' ID)*;

        terminal ID: /[_a-zA-Z][\\w_]*/;
        `.trim();

        const validationResult = await validate(grammar);
        expectNoIssues(validationResult);
    });

    test('Composite terminal regex flags', async () => {
        const grammar = `
        terminal Test: 'Test' /test/i;
        `;
        const validationResult = await validate(grammar);
        expectWarning(validationResult, 'Regular expression flags are only applied if the terminal is not a composition.', {
            node: undefined
        });
    });

    test('Composite terminal regex flags - negative', async () => {
        const grammar = `
        terminal Test: /test/i;
        `;
        const validationResult = await validate(grammar);
        expectNoIssues(validationResult);
    });

    test('Composite terminal no regex flags', async () => {
        const grammar = `
        terminal Test: 'Test' /test/;
        `;
        const validationResult = await validate(grammar);
        expectNoIssues(validationResult);
    });
});

describe('Data type rule return type', () => {

    test('normal rule + data type return type = error', async () => {
        const validationResult = await validate(`
            ParserRule returns string: name='ParserRule';
        `);
        expectError(validationResult, 'Normal parser rules are not allowed to return a primitive value. Use a datatype rule for that.', {
            node: validationResult.document.parseResult.value.rules[0] as GrammarAST.ParserRule,
            property: 'dataType'
        });
    });

    test('data type rule + primitive data type = valid', async () => {
        const validationResult = await validate(`
            ParserRule returns string: 'ParserRule';
        `);
        expectNoIssues(validationResult);
    });

    test('data type rule + complex data type = valid', async () => {
        const validationResult = await validate(`
            ParserRule returns ParserRuleType: 'ParserRule';
            type ParserRuleType = 'ParserRule';
        `);
        expectNoIssues(validationResult);
    });

    test('normal rule + complex data type = error', async () => {
        const validationResult = await validate(`
            ParserRule returns ParserRuleType: name='ParserRule';
            type ParserRuleType = 'ParserRule';
        `);
        expectError(validationResult, 'Normal parser rules are not allowed to return a primitive value. Use a datatype rule for that.', {
            node: validationResult.document.parseResult.value.rules[0] as GrammarAST.ParserRule,
            property: 'returnType'
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
        const crossRef = AstUtils.streamAllContents(validationResult.document.parseResult.value).find(GrammarAST.isCrossReference)!;
        expectError(validationResult, "Could not resolve reference to AbstractType named 'Definition'.", {
            node: crossRef,
            property: 'type'
        });
    });

    test('AtomType validation', () => {
        const unionType = validationResult.document.parseResult.value.types[0].type as GrammarAST.UnionType;
        const missingType = unionType.types[0];
        expectError(validationResult, "Could not resolve reference to AbstractType named 'Reference'.", {
            node: missingType
        });
    });

});

describe('Check Rule Fragment Validation', () => {
    test('Fragment used in type definition', async () => {
        const grammar = expandToString`
            grammar g
            type Type = Fragment;
            fragment Fragment: name=ID;
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const validationResult = await validate(grammar);
        const range = { start: { character: 12, line: 1 }, end: { character: 20, line: 1 } };
        expectError(validationResult, 'Cannot use rule fragments in types.', { range });
    });

    test('Fragment with defined data type', async () => {
        const grammar = expandToString`
            grammar G
            entry R: r1=ID F;
            fragment F returns string: r2=ID;
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const validationResult = await validate(grammar);
        const range = { start: { character: 19, line: 2 }, end: { character: 25, line: 2 } };
        expectError(validationResult, "Fragments assign values to the object of the caller, but don't create a new object themselves. Therefore specifying the type of the returned object is not possible.", { range });
    });

    test('Fragment with defined returnType', async () => {
        const grammar = expandToString`
            grammar G
            entry R: r1=ID F;
            fragment F returns R: r2=ID;
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const validationResult = await validate(grammar);
        const range = { start: { character: 19, line: 2 }, end: { character: 20, line: 2 } };
        expectError(validationResult, "Fragments assign values to the object of the caller, but don't create a new object themselves. Therefore specifying the type of the returned object is not possible.", { range });
    });

    test('Fragment with defined inferredType', async () => {
        const grammar = expandToString`
            grammar G
            entry R: r1=ID F;
            fragment F infers R: r2=ID;
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const validationResult = await validate(grammar);
        const range = { start: { character: 11, line: 2 }, end: { character: 19, line: 2 } };
        expectError(validationResult, "Fragments assign values to the object of the caller, but don't create a new object themselves. Therefore specifying the type of the returned object is not possible.", { range });
    });
});

describe('Check cross-references to inferred types', () => {
    test('infer after the parser rules names', async () => {
        const validationResult = await validate(`
        grammar HelloWorld

        entry Model: a+=A*;

        A infers B: 'a' name=ID (otherA=[B])?; // works

        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `.trim());
        expectNoIssues(validationResult);
    });

    test('infer in the parser rules body', async () => {
        const validationResult = await validate(`
        grammar HelloWorld

        entry Model: a+=A*;

        A: {infer B} 'a' name=ID (otherA=[B])?;

        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `.trim());
        expectNoIssues(validationResult);
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
            property: 'feature'
        });
    });
});

describe('Check grammar with primitives', () => {
    const grammar = `
    grammar PrimGrammar
    entry Expr:
        primitives+=Primitive*;
    Primitive:
        (Word | Bool | Num | LargeInt | DateObj);
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
        expectError(validation, 'Optional elements in Unordered groups are currently not supported', {
            offset: offset,
            length: errorText.length,
            data: {
                code: IssueCodes.OptionalUnorderedGroup
            }
        });
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
            property: 'name',
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
            property: 'name',
            severity: DiagnosticSeverity.Hint
        });
    });

});

describe('Parser rules used only as type in cross-references are not marked as unused, but with a hint suggesting to use a type declaration instead', () => {
    // The used test data are defined at the test cases for possible code actions for these validation problems.
    // these test cases target https://github.com/eclipse-langium/langium/issues/1309

    test('union of two types', async () => {
        await validateRule(beforeTwoAlternatives);
    });

    test('only a single type', async () => {
        await validateRule(beforeSinglelternative);
    });

    test('rule using a nested rule', async () => {
        await validateRule(beforeAnotherRule, 2); // 2 hints, since there is another "unused" rule (which is out-of-scope here)
    });

    test('union of two types, with "infers" keyword', async () => {
        await validateRule(beforeWithInfers);
    });

    async function validateRule(grammar: string, foundDiagnostics: number = 1) {
        const validation = await validate(grammar);
        expect(validation.diagnostics).toHaveLength(foundDiagnostics);
        const ruleWithHint = validation.document.parseResult.value.rules.find(e => e.name === 'Person')!;
        expectIssue(validation, {
            node: ruleWithHint,
            severity: DiagnosticSeverity.Hint
        });
        return ruleWithHint;
    }
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
        const node = AstUtils.streamAllContents(validation.document.parseResult.value).find(predicate)!;
        expectIssue(validation, {
            node,
            message: / is a reserved name of the JavaScript runtime\.$/,
            property,
            severity: DiagnosticSeverity.Error
        });
    }

});

describe('Check grammar names', () => {

    test('Unique grammar names: 2 independent grammars', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [],
        },
        {
            grammar: `
                grammar MyGrammar
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        }
    ));
    test('Unique grammar names: grammar 1 imports grammar 2', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "This grammar name 'MyGrammar' is also used by the grammar in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        }
    ));
    test('Unique grammar names: 2 grammars import each other', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "This grammar name 'MyGrammar' is also used by the grammar in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar
                import "one"
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [
                "This grammar name 'MyGrammar' is also used by the grammar in 'one.langium'.",
            ],
        }
    ));

    test('Unique grammar names: 3 grammars import each other', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "This grammar name 'MyGrammar' is also used by the grammar in 'two.langium'.",
                "This grammar name 'MyGrammar' is also used by the grammar in 'three.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar
                import "three"
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [
                "This grammar name 'MyGrammar' is also used by the grammar in 'three.langium'.",
                "This grammar name 'MyGrammar' is also used by the grammar in 'one.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar
                import "one"
                entry Rule3: 'r3' name='MyName3';
            `,
            filename: 'three.langium',
            expectedErrors: [
                "This grammar name 'MyGrammar' is also used by the grammar in 'one.langium'.",
                "This grammar name 'MyGrammar' is also used by the grammar in 'two.langium'.",
            ],
        }
    ));

    test('Unique grammar names: grammar 1 imports grammar 2, grammar 2 imports grammar 3, only grammar 1 and grammar 3 have the same name', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "This grammar name 'MyGrammar' is also used by the grammar in 'three.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar2
                import "three"
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        },
        {
            grammar: `
                grammar MyGrammar
                entry Rule3: 'r3' name='MyName3';
            `,
            filename: 'three.langium',
            expectedErrors: [],
        }
    ));

    test('Parser rule name is used as name by own grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                entry MyGrammar: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'MyGrammar' is already used here as grammar name.",
            ],
        }
    ));

    test('Parser rule name is used as name by another, directly imported grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry OtherGrammar: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'OtherGrammar' is already used as grammar name in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar OtherGrammar
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        }
    ));

    test('Type name is used as name by another, directly imported grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
                type OtherGrammar = 'Type1';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'OtherGrammar' is already used as grammar name in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar OtherGrammar
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        }
    ));

    test('Interface name is used as name by another, directly imported grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
                interface OtherGrammar {};
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'OtherGrammar' is already used as grammar name in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar OtherGrammar
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        }
    ));

    test('Action inferrs type whose name is used as name by another, directly imported grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' {infer OtherGrammar} name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'OtherGrammar' is already used as grammar name in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar OtherGrammar
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        }
    ));

    test('Fragment rule name might be used as name by another, directly imported grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: OtherGrammar;
                fragment OtherGrammar: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [],
        },
        {
            grammar: `
                grammar OtherGrammar
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        }
    ));

    test('Parser rule name is used as name by another, transitively imported grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry OtherGrammar: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'OtherGrammar' is already used as grammar name in 'three.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar2
                import "three"
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        },
        {
            grammar: `
                grammar OtherGrammar
                entry Rule3: 'r3' name='MyName3';
            `,
            filename: 'three.langium',
            expectedErrors: [],
        }
    ));

    test('Grammar directly imports another grammar with a parser rule whose name is used as name by the importing grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'MyGrammar' is already used as ParserRule name in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar OtherGrammar
                entry MyGrammar: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        }
    ));

    test('Grammar directly imports another grammar with a parser rule whose name is used as name by the imported grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [], // don't report the issue of the imported grammar here again
        },
        {
            grammar: `
                grammar OtherGrammar
                entry OtherGrammar: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [
                "'OtherGrammar' is already used here as grammar name.",
            ],
        }
    ));

    test('Grammar transitively imports another grammar with a parser rule whose name is used as name by the importing grammar', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar1
                import "two"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'MyGrammar1' is already used as ParserRule name in 'three.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar2
                import "three"
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        },
        {
            grammar: `
                grammar MyGrammar3
                entry MyGrammar1: 'r3' name='MyName3';
            `,
            filename: 'three.langium',
            expectedErrors: [],
        }
    ));

    test('Grammar 1 directly imports grammar 2 whose name is used by a parser rule in grammar 3 which is directly imported by grammar 2', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'three.langium' contains the ParserRule with the name 'MyGrammar2', which is already the name of the grammar in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar2
                import "three"
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [
                "'MyGrammar2' is already used as ParserRule name in 'three.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar3
                entry MyGrammar2: 'r3' name='MyName3';
            `,
            filename: 'three.langium',
            expectedErrors: [],
        }
    ));

    test('Grammar 1 directly imports grammar 2 whose name is used by a parser rule in grammar 3 which is directly imported by grammar 1', () => checkNamesInGrammars(
        {
            grammar: `
                grammar MyGrammar
                import "two"
                import "three"
                entry Rule1: 'r1' name='MyName';
            `,
            filename: 'one.langium',
            expectedErrors: [
                "'three.langium' contains the ParserRule with the name 'MyGrammar2', which is already the name of the grammar in 'two.langium'.",
            ],
        },
        {
            grammar: `
                grammar MyGrammar2
                entry Rule2: 'r2' name='MyName2';
            `,
            filename: 'two.langium',
            expectedErrors: [],
        },
        {
            grammar: `
                grammar MyGrammar3
                entry MyGrammar2: 'r3' name='MyName3';
            `,
            filename: 'three.langium',
            expectedErrors: [],
        }
    ));

    interface GrammarInfo {
        grammar: string;
        filename: string;
        expectedErrors: string[];
        document?: LangiumDocument<Grammar>; // internally used
    }

    async function checkNamesInGrammars(...grammars: GrammarInfo[]): Promise<void> {
        for (const info of grammars) {
            const document = services.shared.workspace.LangiumDocumentFactory.fromString<Grammar>(info.grammar, URI.parse(`file:///${info.filename}`));
            services.shared.workspace.LangiumDocuments.addDocument(document);
            info.document = document; // remember the created document for easier checking later
        }
        await services.shared.workspace.DocumentBuilder.build(grammars.map(g => g.document!), { validation: true });
        for (const info of grammars) {
            const foundErrors = (info.document!.diagnostics ?? []).filter(d => d.severity === DiagnosticSeverity.Error).map(d => d.message);
            expect(foundErrors.length, `${info.filename}:\n${foundErrors.join('\n')}`).toBe(info.expectedErrors.length);
            for (let i = 0; i < foundErrors.length; i++) {
                expect(foundErrors[i]).toBe(info.expectedErrors[i]);
            }
        }
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

describe('Clashing token names', () => {

    afterEach(() => {
        clearDocuments(services.grammar);
    });

    test('Local terminal clashing with local keyword', async () => {
        const text = `
        Rule: a='a';
        terminal a: /a/;
        `;
        const validation = await validate(text);
        const terminal = locator.getAstNode(validation.document.parseResult.value, '/rules@1')!;
        expectError(validation, 'Terminal name clashes with existing keyword.', {
            node: terminal,
            property: 'name'
        });
    });

    test('Local terminal clashing with imported keyword', async () => {
        const importedGrammar = await parse(`
        Rule: a='a';
        `);
        const path = importedGrammar.uri.path;
        const grammar = `
        import ".${path}";
        terminal a: /a/;
        `;
        const validation = await validate(grammar);
        const terminal = locator.getAstNode(validation.document.parseResult.value, '/rules@0')!;
        expectError(validation, /Terminal name clashes with imported keyword from/, {
            node: terminal,
            property: 'name'
        });
    });

    test('Imported terminal clashing with local keyword', async () => {
        const importedGrammar = await parse(`
        terminal a: /a/;
        `);
        const path = importedGrammar.uri.path;
        const grammar = `
        import ".${path}";
        Rule: a='a';
        `;
        const validation = await validate(grammar);
        const importNode = validation.document.parseResult.value.imports[0];
        expectError(validation, 'Imported terminals (a) clash with locally defined keywords.', {
            node: importNode,
            property: 'path'
        });
    });

    test('Imported terminal clashing with imported keywords', async () => {
        const importedTerminal = await parse(`
        terminal a: /a/;
        `);
        const importedKeyword = await parse(`
        Rule: a='a';
        `);
        const terminalPath = importedTerminal.uri.path;
        const keywordPath = importedKeyword.uri.path;
        const grammar = `
        import ".${terminalPath}";
        import ".${keywordPath}";
        Test: x='x';
        `;
        const validation = await validate(grammar);
        const importNode = validation.document.parseResult.value.imports[0];
        expectError(validation, 'Imported terminals (a) clash with imported keywords.', {
            node: importNode,
            property: 'path'
        });
    });

    test('Imported terminal not clashing with transitive imported keywords', async () => {
        const importedGrammar = await parse(`
        Rule: a='a';
        terminal a: /a/;
        `);
        let path = importedGrammar.uri.path;
        // remove '.langium' extension
        path = path.substring(0, path.indexOf('.'));
        const grammar = `
        import ".${path}";
        Test: x='x';
        `;
        const validation = await validate(grammar);
        expectNoIssues(validation);
    });
});

describe('Property type is not a mix of cross-ref and non-cross-ref types.', () => {

    test('Parser rule property not mixed.', async () => {
        const validation = await validate(`
        Rule:
            name = 'string'
        ;
        Rule1:
            prop = [Rule]
        ;
        Rule2:
            prop = Rule
        ;
        Rule3:
            prop = ('string' | Rule)
        ;
        `);
        expectNoIssues(validation);
    });

    test('Parser rule property mixed.', async () => {
        const validation = await validate(`
        Rule:
            name = 'string'
        ;
        Rule1:
            prop = ('string' | [Rule])
        ;
        `);
        const rule1Assignment = AstUtils.streamContents(validation.document.parseResult.value.rules[1])
            .filter(node => GrammarAST.isAssignment(node)).head() as GrammarAST.Assignment;
        expect(rule1Assignment).not.toBe(undefined);

        expectError(validation, /Mixing a cross-reference with other types is not supported. Consider splitting property /, {
            node: rule1Assignment!,
            property: 'terminal'
        });
    });
    test('Parser rule property complex mixed.', async () => {
        const validation = await validate(`
        Rule:
            name = 'string'
        ;
        Rule1:
            prop = ('int' | ('string' | [Rule]))
        ;
        `);
        const rule1Assignment = AstUtils.streamContents(validation.document.parseResult.value.rules[1])
            .filter(node => GrammarAST.isAssignment(node)).head() as GrammarAST.Assignment;
        expect(rule1Assignment).not.toBe(undefined);

        expectError(validation, /Mixing a cross-reference with other types is not supported. Consider splitting property /, {
            node: rule1Assignment!,
            property: 'terminal'
        });
    });

});

describe('Assignments with = instead of +=', () => {
    function getMessage(featureName: string): string {
        return `Found multiple assignments to '${featureName}' with the '=' assignment operator. Consider using '+=' instead to prevent data loss.`;
    }
    function getGrammar(content: string): string {
        return `
            grammar HelloWorld
            ${content}
            hidden terminal WS: /\\s+/;
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
    }

    test('assignment with * cardinality', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person* ;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(1);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
    });
    test('assignment with + cardinality', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person+ ;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(1);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
    });

    test('two assignments with single cardinality', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person ',' persons=Person;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(2);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[1].message).toBe(getMessage('persons'));
    });

    test('single assignment with outer * cardinality', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                (',' persons=Person)* ;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(1);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
    });

    test('correct and wrong assignments next to each other', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons += Person*
                greetings = Greeting*;

            Person:
                'person' name=ID;

            Greeting:
                'Hello' person=[Person:ID] '!';
        `));

        expect(validation.diagnostics.length).toBe(1);
        expect(validation.diagnostics[0].message).toBe(getMessage('greetings'));
    });

    test('no problem: assignments in different alternatives', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                (persons=Person) | (persons=Person);
            Person: 'person' name=ID ;
        `));
        expectNoIssues(validation);
    });

    test('assignments in different alternatives, but looped', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                ((persons=Person) | (persons=Person))*;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(2);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[1].message).toBe(getMessage('persons'));
    });

    test('assignments in different alternatives, written twice', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                ((persons=Person) | (persons=Person)) ',' ((persons=Person) | (persons=Person));
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(4);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[1].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[2].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[3].message).toBe(getMessage('persons'));
    });

    test('assignments only in some alternatives, assume the worst case', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                ((persons=Person) | (';')) ',' ((persons=Person) | (';'));
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(2);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[1].message).toBe(getMessage('persons'));
    });

    test('multiple, nested optional assignments', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person (',' persons=Person (',' persons=Person )?)?;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(3);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[1].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[2].message).toBe(getMessage('persons'));
    });

    test('multiple, nested mandatory assignments', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person (',' persons=Person (',' persons=Person ));
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(3);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[1].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[2].message).toBe(getMessage('persons'));
    });

    test('fragments: 2nd critical assignment is located in a fragment', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person ';' Assign;
            fragment Assign:
                ',' persons=Person;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(2);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[1].message).toBe(getMessage('persons'));
    });

    test('fragments: all assignments are located in a fragment', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                Assign ';' Assign;
            fragment Assign:
                ',' persons=Person;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(1);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
    });

    test('fragments: assignment in looped fragment', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                Assign*;
            fragment Assign:
                ',' persons=Person;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(1);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
    });

    test('fragments in alternatives: once in 1st, twice in 2nd alternative', async () => {
        // This suggests the user of Langium to use a list in both cases, which might not be necessary for the 1st alternative.
        // But that is better than loosing a value in the 2nd alternative.
        const validation = await validate(getGrammar(`
            entry Model:
                Assign | (';' Assign Assign);
            fragment Assign:
                ',' persons=Person;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(1);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
    });

    test('no problem: fragments in alternatives', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                Assign | (';' Assign);
            fragment Assign:
                ',' persons=Person;
            Person: 'person' name=ID ;
        `));
        expectNoIssues(validation);
    });

    test('no problem: assignments in different parser rules', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person;
            Person: 'person' name=ID persons=Person;
        `));
        expectNoIssues(validation);
    });

    test('no problem with actions: assignment is looped, but stored in a new object each time', async () => {
        const validation = await validate(getGrammar(`
            entry Model infers Expression:
                Person ({infer Model.left=current} operator=('+' | '-') right=Person)*;
            Person infers Expression:
                {infer Person} 'person' name=ID ;
        `));
        expectNoIssues(validation);
    });

    test('no problem with actions: second assignment is stored in a new object', async () => {
        const validation = await validate(getGrammar(`
            entry Model infers Expression:
                Person (operator=('+' | '-') right=Person {infer Model.left=current} right=Person)?;
            Person infers Expression:
                {infer Person} 'person' name=ID ;
        `));
        expectNoIssues(validation);
    });

    test('no problem with actions: three assignments into three different objects', async () => {
        const validation = await validate(getGrammar(`
            entry Model infers Expression:
                Person (operator=('+' | '-') right=Person {infer Model.left=current} right=Person {infer Model.left=current} right=Person)?;
            Person infers Expression:
                {infer Person} 'person' name=ID ;
        `));
        expectNoIssues(validation);
    });

    test('actions: the rewrite part is a special assignment, which needs to be checked as well!', async () => {
        const validation = await validate(getGrammar(`
            entry Model infers Expression:
                Person ({infer Model.left=current} operator=('+' | '-') right=Person left=Model)*;
            Person infers Expression:
                {infer Person} 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(2);
        expect(validation.diagnostics[0].message).toBe(getMessage('left'));
        expect(validation.diagnostics[1].message).toBe(getMessage('left'));
    });

    test('rewrite actions inside loop #1756 (complete examples, slightly adapted)', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                expr=Expression;

            Expression: Equality;

            Equality infers Expression:
                Literal ( ( {infer Equals.left=current} '==' | {infer NotEquals.left=current} '!=' )  right=Literal)*;

            Literal: value=ID;
        `));
        expectNoIssues(validation);
    });

    test('rewrite actions inside loop #1756 (with a single alternative only)', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                expr=Expression;

            Expression: Equality;

            Equality infers Expression:
                Literal ( {infer Equals.left=current} '==' right=Literal)*;

            Literal: value=ID;
        `));
        expectNoIssues(validation);
    });

    test('rewrite actions inside loop #1756 (single alternative in non-empty group)', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                expr=Expression;

            Expression: Equality;

            Equality infers Expression:
                Literal ( {infer Equals.left=current} 'nonemptygroup' '==' right=Literal)*;

            Literal: value=ID;
        `));
        expectNoIssues(validation);
    });

    test('rewrite actions inside loop #1756 (single alternative in non-empty grouped group)', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                expr=Expression;

            Expression: Equality;

            Equality infers Expression:
                Literal ( ( {infer Equals.left=current} 'nonemptygroup' ) '==' right=Literal)*;

            Literal: value=ID;
        `));
        expectNoIssues(validation);
    });

    test('rewrite actions inside loop #1756 (only a single alternative creates a new object)', async () => {
        // Since we assume the worst case and since 'right' is assigned twice, if the alternative without the rewrite action is used, we expect a warning here as well!
        const validation = await validate(getGrammar(`
            entry Model:
                expr=Expression;

            Expression: Equality;

            Equality infers Expression:
                Literal ( ( {infer Equals.left=current} '==' | '!=' )  right=Literal)*;

            Literal: value=ID;
        `));
        expect(validation.diagnostics.length).toBe(1);
        expect(validation.diagnostics[0].message).toBe(getMessage('right'));
    });

    test('no problem with rewrite actions on top-level: unassigned action', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person {infer Model} persons=Person;
            Person: 'person' name=ID ;
        `));
        expect(validation.diagnostics.length).toBe(2);
        expect(validation.diagnostics[0].message).toBe(getMessage('persons'));
        expect(validation.diagnostics[1].message).toBe(getMessage('persons'));
    });

    test('no problem with rewrite actions on top-level: rewrite action', async () => {
        const validation = await validate(getGrammar(`
            entry Model:
                persons=Person {infer Model.left=current} persons=Person;
            Person: 'person' name=ID ;
        `));
        expectNoIssues(validation);
    });

});

describe('Missing required properties are not arrays or booleans', () => {

    test('No missing properties', async () => {
        const validation = await validate(`
        interface A {
            name: string;
        }
        A returns A:
            name = 'string'
        ;
        `);
        expectNoIssues(validation);
    });

    test.each(['number[]', 'boolean'])('Missing mandatory %s properties', async (type) => {
        const validation = await validate(`
        interface A {
            name: string;
            values: ${type};
        }
        A returns A:
            name = 'string'
        ;
        `);
        expectNoIssues(validation);
    });

    test.each(['string', 'number', 'bigint'])('Missing non-mandatory %s properties', async (type) => {
        const validation = await validate(`
        interface A {
            name: string;
            value: ${type};
        }
        A returns A:
            name = 'string'
        ;
        `);
        const rule = validation.document.parseResult.value.rules[0];
        expectError(validation, /A property 'value' is expected. /, {
            node: rule,
            property: 'name'
        });
    });

});

describe('Cross-reference to type union is only valid if all alternatives are AST nodes.', () => {
    afterEach(() => {
        clearDocuments(services.grammar);
    });

    test('Should not return error on union type composed only of AST nodes', async () => {
        const validationResult = await validate(`
        A: 'A' name=ID;
        B: 'B' name=ID;
        type T = A | B;
        R: a=[T];

        terminal ID returns string: /[a-z]+/;
        `);
        expectNoIssues(validationResult);
    });

    test('Should return validation error on union type containing a primitive', async () => {
        const validationResult = await validate(`
        A: 'A' name=ID;
        type B = 'B';
        type T = A | B;
        R: a=[T];

        terminal ID returns string: /[a-z]+/;
        `);
        const rule = validationResult.document.parseResult.value.rules[1] as GrammarAST.ParserRule;
        const reference = ((rule.definition as GrammarAST.Assignment).terminal as GrammarAST.Assignment).terminal as GrammarAST.CrossReference;
        expectError(
            validationResult,
            /Cross-reference on type union is only valid if all alternatives are AST nodes. B is not an AST node./,
            {
                node: reference,
                property: 'type'
            }
        );
    });

    test('Should return validation error on union type containing nested primitives', async () => {
        const validationResult = await validate(`
        A: 'A' name=ID;
        B: 'B' name=ID;
        type C = 'C';
        type D = B | C;
        type T = A | D;
        R: a=[T];

        terminal ID returns string: /[a-z]+/;
        `);
        const rule = validationResult.document.parseResult.value.rules[2] as GrammarAST.ParserRule;
        const reference = ((rule.definition as GrammarAST.Assignment).terminal as GrammarAST.Assignment).terminal as GrammarAST.CrossReference;
        expectError(
            validationResult,
            /Cross-reference on type union is only valid if all alternatives are AST nodes. C is not an AST node./,
            {
                node: reference,
                property: 'type'
            }
        );
    });

    test('Should return validation error on union type containing several non-AST nodes', async () => {
        const validationResult = await validate(`
        type A = 'A';
        type T = A | "foo"";
        R: a=[T];

        terminal ID returns string: /[a-z]+/;
        `);
        const rule = validationResult.document.parseResult.value.rules[0] as GrammarAST.ParserRule;
        const reference = ((rule.definition as GrammarAST.Assignment).terminal as GrammarAST.Assignment).terminal as GrammarAST.CrossReference;
        expectError(
            validationResult,
            /Cross-reference on type union is only valid if all alternatives are AST nodes. A, "foo" are not AST nodes./,
            {
                node: reference,
                property: 'type'
            }
        );
    });

    test('No missing properties', async () => {
        const validation = await validate(`
        interface A {
            a: string;
        }
        interface C extends A {}
        A returns A: B | C;
        B returns A: a='foo';
        C returns A: {C} a='bar';
        `);
        expectNoIssues(validation);
    });

    test('Cross-reference terminals must be of type string', async () => {
        const validationResult = await validate(`
        interface A {}
        RuleA:
            a1=[A:DTA]
            a2=[A:INT];
        DTA returns number: '1';
        terminal INT returns number: /[0-9]+/;
        `);

        const grammar = validationResult.document.parseResult.value;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rules = grammar.rules as any;
        expectError(validationResult, /Data type rules for cross-references must be of type string./, {
            node: rules[0].definition.elements[0].terminal.terminal,
            property: 'rule'
        });
        expectError(validationResult, /Terminal rules for cross-references must be of type string./, {
            node: rules[0].definition.elements[1].terminal.terminal,
            property: 'rule'
        });
    });

    test('Hidden terminals can be used in terminal lookahead', async () => {
        const validationResult = await validate(`
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        terminal TEST: ID (?=WS);`);

        expectNoIssues(validationResult);
    });

    test('Hidden terminals can be used in terminal lookahead regardless of terminal grouping', async () => {
        const validationResult = await validate(`
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        terminal TEST: ID (?=WS (WS (WS | WS)));`);

        expectNoIssues(validationResult);
    });
});

describe('Prohibit empty parser rules', async () => {

    function detectEmptyRules(validationResult: ValidationResult<GrammarAST.Grammar>, ...ruleNames: string[]) {
        for (const rule of validationResult.document.parseResult.value.rules) {
            if (GrammarAST.isParserRule(rule)) {
                if (ruleNames.includes(rule.name)) {
                    expectWarning(validationResult, 'This parser rule potentially consumes no input.', {
                        node: rule, property: 'name'
                    });
                } else {
                    expectNoIssues(validationResult, {
                        node: rule, property: 'name', message: 'This parser rule potentially consumes no input.'
                    });
                }
            }
        }
    }

    test('Keywords, Rule calls, cross references', async () => {
        const grammarWithoutOptionals = `
        Name: name=ID;
        Ref: 'Hello' 'to' who=[Name:ID];
        Call: Name;
        Word returns string: 'word';

        terminal ID: /[a-zA-Z]/+;
        hidden terminal WS: /\\s+/;`;
        const validationResult = await validate(grammarWithoutOptionals);
        detectEmptyRules(validationResult);
    });

    test('Optional cardinality', async () => {
        const grammarWithOptionals = `
        B: (x=ID);
        C: (x=ID)?;
        D: (x=ID)*;

        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammarWithOptionals);
        detectEmptyRules(validationResult, 'C', 'D');
    });

    test('Alternatives', async () => {
        const grammarWithGroups = `
        A: (name=ID  | 'test');
        B: (name=ID? | 'test');
        C: (name=ID  | 'test')?;

        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammarWithGroups);
        expect(validationResult.diagnostics).toHaveLength(2);
        detectEmptyRules(validationResult, 'B', 'C');
    });

    test('Groups', async () => {
        const grammarWithGroups = `
        A: name=ID 'test';
        B: name=ID? 'test';
        C: name=ID? 'test'?;

        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammarWithGroups);
        detectEmptyRules(validationResult, 'C');
    });

    test('Unordered Groups', async () => {
        const grammarWithGroups = `
        A: (name=ID & 'test');

        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammarWithGroups);
        detectEmptyRules(validationResult, 'A');
    });

    test('Actions', async () => {
        const specialGrammar = `
        A: {infer Empty};
        B: {infer Value} name=ID?;
        C: {infer Value} name=ID;

        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(specialGrammar);
        detectEmptyRules(validationResult, 'A', 'B');
    });

    test('Fragments and entry rules', async () => {
        const specialGrammar = `
        grammar Test
        entry Rule: items+=Item*;
        Item: name=ID Content;
        EmptyItem: Content;
        fragment Content: value=ID?;

        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(specialGrammar);
        detectEmptyRules(validationResult, 'EmptyItem');
    });
});

describe('Rule call parameters validation', () => {

    test('Rule with expected arguments but no arguments given', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule;
        Rule<Param1, Param2>:
            <Param1>value=ID | <Param2>'foo';
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        const ruleCall = AstUtils.streamAllContents(validationResult.document.parseResult.value).find(GrammarAST.isRuleCall)!;
        expectError(validationResult, "Rule 'Rule' expects 2 arguments.", {
            node: ruleCall
        });
    });

    test('Rule with no parameters but arguments given', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<true>;
        Rule:
            <Param1>value=ID | <Param2>'foo';
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        const ruleCall = AstUtils.streamAllContents(validationResult.document.parseResult.value).find(GrammarAST.isRuleCall)!;
        expectError(validationResult, "Rule 'Rule' does not accept any arguments.", {
            node: ruleCall
        });
    });

    test('Rule with mismatched number of unnamed arguments', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<true>;
        Rule<Param1, Param2>:
            <Param1>value=ID | <Param2>'foo';
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        const ruleCall = AstUtils.streamAllContents(validationResult.document.parseResult.value).find(GrammarAST.isRuleCall)!;
        expectError(validationResult, "Rule 'Rule' expects 2 arguments, but got 1.", {
            node: ruleCall
        });
    });

    test('Rule with correct number of unnamed arguments - should pass', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<true, false>;
        Rule<Param1, Param2>:
            <Param1>value=ID | <Param2>'foo';
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        expectNoIssues(validationResult);
    });

    test('Mixing named and unnamed arguments', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<true, Param2=false>;
        Rule<Param1, Param2>:
            <Param1>value=ID | <Param2>'foo';
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        const ruleCall = AstUtils.streamAllContents(validationResult.document.parseResult.value).find(GrammarAST.isRuleCall)!;
        expectError(validationResult, 'Cannot mix named and unnamed arguments in rule call.', {
            node: ruleCall
        });
    });

    test('Duplicate named arguments', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<Param1=true, Param1=false>;
        Rule<Param1, Param2>:
            <Param1>value=ID | <Param2>'foo';
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        const namedArg = AstUtils.streamAllContents(validationResult.document.parseResult.value).filter(GrammarAST.isNamedArgument).toArray()[1];
        expectError(validationResult, "Parameter 'Param1' is assigned multiple times.", {
            node: namedArg,
            property: 'parameter'
        });
    });

    test('Incomplete named arguments - missing parameter', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<Param1=true>;
        Rule<Param1, Param2>:
            <Param1>value=ID | <Param2>'foo';
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        const ruleCall = AstUtils.streamAllContents(validationResult.document.parseResult.value).find(GrammarAST.isRuleCall)!;
        expectError(validationResult, "Parameter 'Param2' is not assigned in rule call.", {
            node: ruleCall
        });
    });

    test('Complete named arguments - should pass', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<Param1=true, Param2=false>;
        Rule<Param1, Param2>:
            <Param1>value=ID | <Param2>'foo';
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        expectNoIssues(validationResult);
    });

    test('Terminal rule with arguments should error', async () => {
        const grammar = `
        grammar Test
        entry Main:
            ID<true>;
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        const ruleCall = AstUtils.streamAllContents(validationResult.document.parseResult.value).find(GrammarAST.isRuleCall)!;
        expectError(validationResult, 'Terminal rules do not accept any arguments', {
            node: ruleCall
        });
    });

});

describe('Rule parameter validation', () => {

    test('Duplicate parameter names should error', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<true, false>;
        Rule<Param1, Param1>:
            <Param1>value=ID;
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        expect(validationResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(2);
        const parameters = AstUtils.streamAllContents(validationResult.document.parseResult.value)
            .filter(GrammarAST.isParameter).toArray();
        expectError(validationResult, "Parameter 'Param1' is declared multiple times.", {
            node: parameters[0],
            property: 'name'
        });
        expectError(validationResult, "Parameter 'Param1' is declared multiple times.", {
            node: parameters[1],
            property: 'name'
        });
    });

    test('Unused parameters should show hint', async () => {
        const grammar = `
        grammar Test
        entry Main:
            Rule<true, false>;
        Rule<UsedParam, UnusedParam>:
            <UsedParam>value=ID;
        terminal ID: /[a-zA-Z]+/;
        `;
        const validationResult = await validate(grammar);
        expect(validationResult.diagnostics).toHaveLength(1);
        const unusedParam = AstUtils.streamAllContents(validationResult.document.parseResult.value)
            .filter(GrammarAST.isParameter)
            .find(p => p.name === 'UnusedParam')!;
        expectIssue(validationResult, {
            node: unusedParam,
            severity: DiagnosticSeverity.Hint,
            message: "Parameter 'UnusedParam' is unused."
        });
    });

});

describe('Infix rule type validation', () => {
    test('Infix rule with data type should error', async () => {
        const validation = await validate(`
        grammar Test
        entry Model: Expression;
        infix Expression on Primary returns string:
            '%'
            > '^'
            > '*' | '/'
            > '+' | '-';
        Primary: value=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `);
        const rule = validation.document.parseResult.value.rules[1] as GrammarAST.InfixRule;
        expectError(validation, 'Infix rules are not allowed to return a primitive value.', {
            node: rule,
            property: 'dataType'
        });
    });
});

describe('Check validation is not crashing', async () => {

    test('Calling missing terminal rule', async () => {
        const specialGrammar = `
        grammar Foo
        entry Foo:
            TERMINAL;

        terminal TERMINAL returns string:
            MISSING_TERMINAL;
        `;
        const validationResult = await validate(specialGrammar);
        expect(validationResult).toBeDefined();
    });
});

describe('Strict type validation', () => {
    const strictModeServices = createLangiumGrammarServices(EmptyFileSystem);
    strictModeServices.grammar.validation.LangiumGrammarValidator.options = { types: 'strict' };
    const validateStrict = validationHelper<GrammarAST.Grammar>(strictModeServices.grammar);

    beforeEach(() => clearDocuments(strictModeServices.shared));

    test('Inferred parser rules should error in strict mode', async () => {
        const grammar = `
        grammar Test
        entry InferredRule infers InferredRule: name=ID;
        terminal ID: /[a-zA-Z]+/;
        `;

        const validationResult = await validateStrict(grammar);
        const parserRule = validationResult.document.parseResult.value.rules[0] as GrammarAST.ParserRule;
        const inferredType = parserRule.inferredType;
        expectError(validationResult, 'Inferred types are not allowed in strict mode.', {
            node: inferredType,
            property: 'name',
            data: {
                code: IssueCodes.InvalidInfers
            }
        });
    });

    test('Implicitly inferred parser rules should error in strict mode', async () => {
        const grammar = `
        grammar Test
        entry InferredRule: name=ID;
        terminal ID: /[a-zA-Z]+/;
        `;

        const validationResult = await validateStrict(grammar);
        const parserRule = validationResult.document.parseResult.value.rules[0];
        expectError(validationResult, 'Inferred types are not allowed in strict mode.', {
            node: parserRule,
            property: 'name',
            data: {
                code: IssueCodes.InvalidInfers
            }
        });
    });

    test('Inferred actions should error in strict mode', async () => {
        const grammar = `
        grammar Test
        entry Rule: {infer InferredAction} name=ID;
        terminal ID: /[a-zA-Z]+/;
        `;

        const validationResult = await validateStrict(grammar);
        const parserRule = validationResult.document.parseResult.value.rules[0] as GrammarAST.ParserRule;
        const group = parserRule.definition as GrammarAST.Group;
        const action = group.elements[0] as GrammarAST.Action;
        expectError(validationResult, 'Inferred types are not allowed in strict mode.', {
            node: action.inferredType!,
            property: 'name',
            data: {
                code: IssueCodes.InvalidInfers
            }
        });
    });

    test('Declared types should work in strict mode', async () => {
        const grammar = `
        grammar Test
        interface DeclaredType {
            name: string
        }
        entry Rule returns DeclaredType: name=ID;
        terminal ID: /[a-zA-Z]+/;
        `;

        const validationResult = await validateStrict(grammar);
        expectNoIssues(validationResult);
    });
});
