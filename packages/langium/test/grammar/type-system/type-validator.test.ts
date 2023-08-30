/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Diagnostic } from 'vscode-languageserver';
import type { GrammarAST } from '../../../src';
import type { Assignment } from '../../../src/grammar/generated/ast';
import { describe, expect, test } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { createLangiumGrammarServices, EmptyFileSystem, streamAllContents, streamContents } from '../../../src';
import { isAssignment } from '../../../src/grammar/generated/ast';
import { expectError, expectNoIssues, parseDocument, validationHelper } from '../../../src/test';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const validate = validationHelper<GrammarAST.Grammar>(grammarServices);

describe('validate params in types', () => {

    // verifies that missing properties that are required are reported in the correct spot
    test('verify missing required property error, for single rule', async () => {
        const prog = `
        interface B {
            name:string
            count?:string
        }
        X2 returns B: count=ID;
        terminal ID: /[a-zA-Z_][\\w_]*/;
        `.trim();
        // verify we only have 1 error, associated with a missing 'name' prop
        const document = await parseDocument(grammarServices, prog);
        let diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        diagnostics = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
        expect(diagnostics).toHaveLength(1);

        // verify location of diagnostic
        const d = diagnostics[0];
        expect(d.range.start).toEqual({ character: 8, line: 4 });
        expect(d.range.end).toEqual({ character: 10, line: 4 });
    });

    // verifies that missing required params use the right msg & position
    test('verify missing required param error is present for the correct rule', async () => {
        const prog = `
        interface A {
            name:string
            count?:number
        }
        X returns A: name=ID;
        Y returns A: count=NUMBER;
        terminal ID: /[a-zA-Z_][\\w_]*/;
        terminal NUMBER returns number: /[0-9]+(\\.[0-9]+)?/;
        `.trim();

        // expect exactly 1 error, associated with a missing 'name' prop for type 'A'
        const document = await parseDocument(grammarServices, prog);
        let diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        diagnostics = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
        expect(diagnostics).toHaveLength(1);

        // verify the location of the single diagnostic error, should be only for the 2nd rule
        const d = diagnostics[0];
        expect(d.range.start).toEqual({ character: 8, line: 5 });
        expect(d.range.end).toEqual({ character: 34, line: 5 });
    });

    // tests that an optional param in a declared type can be optionally present in a rule
    test('optional param should not invalidate type', async () => {
        const prog = `
        interface MyType {
            name: string
            count?: number
        }
        X returns MyType : name=ID;
        Y returns MyType : name=ID count=NUMBER;
        terminal ID: /[a-zA-Z_][\\w_]*/;
        terminal NUMBER returns number: /[0-9]+(\\.[0-9]+)?/;
        `.trim();

        // verify we have no errors
        const validation = await validate(prog);
        expectNoIssues(validation, {
            severity: DiagnosticSeverity.Error
        });
    });

});

describe('validate inferred types', () => {

    test('inferred type in cross-reference should not produce an error', async () => {
        const prog = `
        A infers B: 'a' name=ID (otherA=[B])?;
        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `.trim();

        const validation = await validate(prog);
        expectNoIssues(validation, {
            severity: DiagnosticSeverity.Error
        });
    });
});

describe('Work with imported declared types', () => {

    test('Returning imported type should not produce an error #507', async () => {

        const referencingDoc = await parseDocument(grammarServices, `
        interface IRoot { name: string }
        `);
        const prog = `
        grammar Test_file_ref
        import "${referencingDoc.uri.path.split('/').pop()}"
        entry Root returns IRoot:
            name=ID;

        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
        `.trim();
        const validation = await validate(prog);
        expectNoIssues(validation, {
            severity: DiagnosticSeverity.Error
        });
    });
});

describe('validate declared types', () => {

    test('use langium keywords as properties in declared types', async () => {

        const validKeywordsAsId = [
            'current',
            'entry',
            'extends',
            'false',
            'fragment',
            'grammar',
            'hidden',
            'import',
            'infer',
            'infers',
            'interface',
            'returns',
            'terminal',
            'true',
            'type',
            'with',
            // primitive type, excluding Date
            'string',
            'number',
            'boolean',
            'bigint'
        ];

        const prog = `
        interface Keywords {
            ${validKeywordsAsId.map(keyword => keyword + ': string').join('\n    ')}
        }
        Keywords returns Keywords: ${validKeywordsAsId.map(keyword => keyword + '=ID').join(' ')};
        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `.trim();
        const validation = await validate(prog);
        expectNoIssues(validation, {
            severity: DiagnosticSeverity.Error
        });
    });

    test('Can return an interface from a rule that would return a union type', async () => {
        const grammar = `
        X returns X: Y | Z;
        Y: y='y';
        Z: z='z';
        // X would normally return a union type of Y | Z
        // This forces it into an interface
        interface X { }
        `;
        const validation = await validate(grammar);
        expectNoIssues(validation, {
            severity: DiagnosticSeverity.Error
        });
    });

    test('Can reuse a type declaration consisting of primitive types as property type', async () => {
        const validationResult = await validate(`
            interface State {
                type: StateType;
            }
            
            type StateType = 'normal' | 'final';
            
            State returns State: type=('normal' | 'final');
        `);
        expectNoIssues(validationResult);
    });

    test('Shows error on unassignable type union used as property type', async () => {
        const validationResult = await validate(`
            interface State {
                type: StateType;
            }
            
            type StateType = 'normal' | 'final';
            
            State returns State: type='default';
        `);

        expectError(validationResult, "The assigned type '\"default\"' is not compatible with the declared property 'type' of type 'StateType'.", {
            range: {
                start: {
                    line: 7,
                    character: 33
                },
                end: {
                    line: 7,
                    character: 37
                }
            }
        });
    });

    test('Does not crash with cyclic type definition', async () => {
        const validationResult = await validate(`
            type Mytype = Mytype | string;
            interface A {
                propA: Mytype;
            }
            interface B {
                propB: string;
            }
            RuleA returns A: propA='a';
            RuleB returns B: propB=DTB;
            DTB returns Mytype: 'b';
        `);
        expect(validationResult.diagnostics).toHaveLength(1);
        const grammar = validationResult.document.parseResult.value;
        expectError(validationResult, /Type alias 'Mytype' circularly references itself./, {
            node: grammar.types[0],
            property: 'name'
        });
    });

    test('Does not crash with cyclic interface definition', async () => {
        const validationResult = await validate(`
            interface Basetype extends Mytype {}
            interface Mytype extends Basetype {}
            interface A {
                propA: Mytype;
            }
            interface B {
                propB: Basetype;
            }
            RuleA returns A: propA=RuleC;
            RuleB returns B: propB=RuleC;
            RuleC returns Mytype: {Mytype} 'c';
        `);
        expect(validationResult.diagnostics).toHaveLength(2);
        const grammar = validationResult.document.parseResult.value;
        expectError(validationResult, /Type 'Mytype' recursively references itself as a base type./, {
            node: grammar.interfaces[1],
            property: 'name'
        });
    });

    test('Does not report false positive cyclic type definition', async () => {
        const validationResult = await validate(`
            interface A {
                propA: Mytype;
            }
            interface B {
                propB: string;
            }
            type Mytype = A | A;
        `);
        expect(validationResult.diagnostics).toHaveLength(0);
    });

    test('Does not report false positive cyclic interface definition', async () => {
        const validationResult = await validate(`
            interface Basetype {}
            interface Mytype extends Basetype, Basetype {}
            interface A {
                propA: Mytype;
            }
            interface B {
                propB: Basetype;
            }
            RuleA returns A: propA=RuleC;
            RuleB returns B: propB=RuleC;
            RuleC returns Mytype: {Mytype} 'c';
        `);
        expect(validationResult.diagnostics).toHaveLength(0);
    });
});

describe('validate actions that use declared types', () => {

    test('verify extra properties in some actions', async () => {
        const prog = `
        Expression: Addition;
        interface BinaryExpression {
            right: Expression
            operator: '+' | '-' | '*' | '/'
        }
        Addition infers Expression:
            Multiplication ({BinaryExpression.left=current} operator=('+' | '-') right=Multiplication)*;
        Multiplication infers Expression:
            PrimaryExpression ({BinaryExpression.left=current} operator=('*' | '/') right=PrimaryExpression)*;
        PrimaryExpression infers Expression:
            {infer NumberLiteral} value=NUMBER;
        terminal NUMBER returns number: /[0-9]+(\\.[0-9]+)?/;
        `.trim();

        // verify we have 2 errors: extra assignment `left` for `Addition` and `Multiplication` rules
        const document = await parseDocument(grammarServices, prog);
        const diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(2);
    });

});

describe('validate properties duplication in types hierarchy', () => {

    test('verify extra properties in some parser rules', async () => {
        const prog = `
        interface A {
            name: string
        }
        X returns A : name=ID count=ID;
        Y returns A : name=ID count=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `.trim();

        // verify we have 2 errors: extra assignment `count` for `X` and `Y` rules
        const document = await parseDocument(grammarServices, prog);
        const diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(2);
    });

    test('verify 2 parents have the same property', async () => {
        const prog = `
        interface Y {
            y_prop: string
            common: number
        }
        interface Z {
            z_prop: string
            common: number
        }
        interface X extends Y, Z {
            name: string
        }
        `.trim();

        // verify we have no errors
        const document = await parseDocument(grammarServices, prog);
        const diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(0);
    });

    test('verify parent and child have the same property', async () => {
        const prog = `
        interface Y {
            y_prop: string
            common: number
        }
        interface X extends Y {
            name: string
            common: number
        }
        `.trim();

        // verify we have no errors
        const document = await parseDocument(grammarServices, prog);
        const diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(1);
    });

    test('verify a type has properties duplication', async () => {
        const prog = `
        interface X {
            name: string
            name: string
        }
        `.trim();

        // verify we have the only 1 error
        const document = await parseDocument(grammarServices, prog);
        const diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(2);
    });

    test('verify incompatible types of parents properties', async () => {
        const prog = `
        interface X {
            name: string
        }
        Y : name=NUMBER;
        interface Z extends X, Y {}
        terminal NUMBER returns number: /[0-9]+(\\.[0-9]*)?/;
        `.trim();

        // verify we have 1 error: a property `name` exists in both parents but has different type
        const document = await parseDocument(grammarServices, prog);
        const diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(2);
    });

});

describe('Property type is not a mix of cross-ref and non-cross-ref types.', () => {

    test('Parser rule property inferred mixed.', async () => {
        const validation = await validate(`
            entry AbstractElement:
                Foo | Bar;

            Foo infers AbstractElement:
                prop=[AbstractElement:ID]
            ;

            Bar infers AbstractElement:
                prop='Bar'
            ;

            terminal ID: /[_a-zA-Z][\\w_]*/;
        `);
        const rule1Assignment = streamContents(validation.document.parseResult.value.rules[1])
            .filter(node => isAssignment(node)).head() as Assignment;
        expect(rule1Assignment).not.toBe(undefined);

        expectError(validation, /Mixing a cross-reference with other types is not supported. Consider splitting property /, {
            node: rule1Assignment!
        });
    });

    test('Parser rule properties inferred mixed.', async () => {
        const validation = await validate(`
            Rule:
                prop = 'string' | prop = [Rule:ID]
            ;
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `);
        const propAssignments = streamAllContents(validation.document.parseResult.value.rules[0])
            .filter(node => isAssignment(node)).toArray();
        expect(propAssignments.length).toBe(2);

        expectError(validation, /Mixing a cross-reference with other types is not supported. Consider splitting property /, {
            node: propAssignments[0]!
        });
    });

    test('Interface declaration property not mixed.', async () => {
        const validation = await validate(`
            interface Rule {
                name: 'string'
            }

            interface Rule1 {
                prop: @Rule
            }

            interface Rule2 {
                prop: Rule
            }

            interface Rule3 {
                prop: 'string' | Rule
            }
        `);
        expectNoIssues(validation);
    });

    test('Interface declaration property mixed.', async () => {
        const validation = await validate(`
            interface Rule {
                prop: @Rule | 'string'
            }
        `);
        const attribute = validation.document.parseResult.value.interfaces[0].attributes[0];
        expect(attribute).not.toBe(undefined);

        expectError(validation, /Mixing a cross-reference with other types is not supported. Consider splitting property /, {
            node: attribute
        });
    });
});

// https://github.com/langium/langium/issues/823
describe('Property types validation takes in account types hierarchy', () => {

    test('Type aliases can be assigned to primitive types.', async () => {
        const validation = await validate(`
            interface TypeA {
                name: string
            }
            A returns TypeA: name=QualifiedName;
            QualifiedName returns string: 'QualifiedName';
        `);

        expectNoIssues(validation);
    });

    test('Child type can be assigned correctly.', async () => {
        const validation = await validate(`
            Named: name = ID;
            Expression: NamedRef;
            NamedRef returns NamedRef: ref=[Named];
            QualifiedRef returns QualifiedRef: qualifier=NamedRef ref=[Named];
            QualifiedRefWithAction infers Expression: NamedRef {QualifiedRef.qualifier=current} '.' ref=[Named];
            terminal ID: /[_a-zA-Z][\\w_]*/;

            interface NamedRef {
                ref: @Named
            }

            interface QualifiedRef extends NamedRef {
                qualifier: Expression
            }
        `);

        expectNoIssues(validation);
    });

    // here `X` can be `string` or `XY` and `Y` cab be `number` or `XY
    test('Usage of child type with some parents is validated correctly.', async () => {
        const validation = await validate(`
            X returns string: 'X';
            Y returns number: NUMBER;
            QualifiedRef: name=NUMBER;
            XY returns XY: X | Y | QualifiedRef;
            terminal NUMBER returns number: /[0-9]+(\\.[0-9]+)?/;

            type XY = string | number | QualifiedRef;
        `);

        expectNoIssues(validation);
    });

    test('Keywords are subtypes of strings.', async () => {
        const validation = await validate(`
            interface BinaryExpression {
                left: Expression
                right: Expression
                operator: string
            }

            Expression:
                PrimaryExpression ({BinaryExpression.left=current} operator=('+' | '-') right=PrimaryExpression)*;

            PrimaryExpression infers Expression:
                {infer NumberLiteral} value=NUMBER;

            terminal NUMBER returns number: /[0-9]+(\\.[0-9]*)?/;
        `);

        expectNoIssues(validation);
    });

    test('Type aliases can be assigned correctly for types.', async () => {
        const validation = await validate(`
            X: name=ID;
            AliasX: X;

            interface YType {
                prop: AliasX
            }
            Y returns YType: prop=X;

            interface ZType {
                prop: X
            }
            Z returns ZType: prop=AliasX;

            terminal ID: /[_a-zA-Z][\\w_]*/;
        `);

        expectNoIssues(validation);
    });

    test('Should create error on assignments with incorrect hierarchy.', async () => {
        const validation = await validate(`
            interface Y {
                y: Z1
            }

            interface Z {
                name: string
            }

            interface Z1 extends Z {
                z: number
            }

            interface Z2 extends Z {
                a: string
            }

            Y returns Y: y=Z2;

            Z1 returns Z1: z=NUMBER name=ID;
            Z2 returns Z2: a=ID name=ID;

            terminal ID: /[_a-zA-Z][\\w_]*/;
            terminal NUMBER returns number: /[0-9]+(\\.[0-9]*)?/;
        `);

        const assignment = streamAllContents(validation.document.parseResult.value).filter(isAssignment).toArray()[0];
        expectError(validation, "The assigned type 'Z2' is not compatible with the declared property 'y' of type 'Z1'.", {
            node: assignment,
            property: 'feature'
        });
    });

    test('No false positive on declared type assignment', async () => {
        const validation = await validate(`
        interface A {}
        interface B extends A {}

        interface Test {
            value: A;
        }

        B returns B: {B};

        Test returns Test:
            value=B
        ;`);

        expectNoIssues(validation);
    });
});
