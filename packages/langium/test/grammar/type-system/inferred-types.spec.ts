/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstTypes, createLangiumGrammarServices, Grammar, InterfaceType, isDataTypeRule, isParserRule, Property, PropertyType, UnionType } from '../../../src';
import { collectInferredTypes } from '../../../src/grammar/type-system/inferred-types';
import { parseHelper } from '../../../src/test';

function describeTypes(name: string, grammar: string, description: (types: AstTypes) => void | Promise<void>): void {
    describe(name, () => {
        const types: AstTypes = {
            interfaces: [],
            unions: []
        };
        beforeAll(async () => {
            const newTypes = await getTypes(grammar);
            types.interfaces = newTypes.interfaces;
            types.unions = newTypes.unions;
        });
        description.call(undefined, types);
    });
}

describeTypes('inferred types of simple grammars', `
    A: name=ID value=NUMBER?;
    B: name=FQN values+=NUMBER;
    C: 'c' ref=[A];

    FQN: ID;
    terminal ID returns string: /string/;
    terminal NUMBER returns number: /number/;
`, types => {
    test('A is inferred with name:string and value?:number', () => {
        const a = getType(types, 'A') as InterfaceType;
        expect(a).toBeDefined();
        expectProperty(a, {
            name: 'name',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['string']
            }]
        });
        expectProperty(a, {
            name: 'value',
            optional: true,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['number']
            }]
        });
    });

    test('B is inferred with name:FQN and values:number[]', () => {
        const b = getType(types, 'B') as InterfaceType;
        expect(b).toBeDefined();
        expectProperty(b, {
            name: 'name',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['FQN']
            }]
        });
        expectProperty(b, {
            name: 'values',
            optional: false,
            typeAlternatives: [{
                array: true,
                reference: false,
                types: ['number']
            }]
        });
    });

    test('C is inferred with ref:@A', () => {
        const c = getType(types, 'C') as InterfaceType;
        expect(c).toBeDefined();
        expectProperty(c, {
            name: 'ref',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: true,
                types: ['A']
            }]
        });
    });

    test('FQN is created as an union type', () => {
        const fqn = getType(types, 'FQN') as UnionType;
        expectUnion(fqn, [
            {
                array: false,
                reference: false,
                types: ['string']
            }
        ]);
    });
});

describeTypes('inferred types for alternatives', `
    A: name=ID | name=NUMBER;
    B: name=(ID | NUMBER);
    C: A | B;
    D: A | B | name=ID;
    E: name=ID | value=NUMBER;
    

    terminal ID returns string: /string/;
    terminal NUMBER returns number: /number/;
`, types => {
    test('A is inferred with name:(string)|(number)', () => {
        const a = getType(types, 'A') as InterfaceType;
        expect(a).toBeDefined();
        expect(a.interfaceSuperTypes).toEqual(['D']);
        expect(a.properties).toHaveLength(1);
        expectProperty(a, {
            name: 'name',
            optional: false,
            typeAlternatives: [
                {
                    array: false,
                    reference: false,
                    types: ['string']
                },
                {
                    array: false,
                    reference: false,
                    types: ['number']
                }
            ]
        });
    });

    test('B is inferred with name:(number|string)', () => {
        const b = getType(types, 'B') as InterfaceType;
        expect(b).toBeDefined();
        expect(b.interfaceSuperTypes).toEqual(['D']);
        expect(b.properties).toHaveLength(1);
        expectProperty(b, {
            name: 'name',
            optional: false,
            typeAlternatives: [
                {
                    array: false,
                    reference: false,
                    types: ['string']
                },
                {
                    array: false,
                    reference: false,
                    types: ['number']
                }
            ]
        });
    });

    test('C is inferred as union type A | B', () => {
        const c = getType(types, 'C') as UnionType;
        expect(c).toBeDefined();
        expectUnion(c, [{
            array: false,
            reference: false,
            types: ['A', 'B']
        }]);
    });

    test('D is inferred as name:string', () => {
        const d = getType(types, 'D') as InterfaceType;
        expect(d).toBeDefined();
        expect(d.interfaceSuperTypes).toHaveLength(0);
        expect(d.properties).toHaveLength(1);
        expectProperty(d, {
            name: 'name',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['string']
            }]
        });
    });

    test('E is inferred with name?:string, value?: number', () => {
        const e = getType(types, 'E') as InterfaceType;
        expect(e).toBeDefined();
        expectProperty(e, {
            name: 'name',
            optional: true,
            typeAlternatives: [
                {
                    array: false,
                    reference: false,
                    types: ['string']
                }
            ]
        });
        expectProperty(e, {
            name: 'value',
            optional: true,
            typeAlternatives: [
                {
                    array: false,
                    reference: false,
                    types: ['number']
                }
            ]
        });
    });

});

describeTypes('inferred types using chained actions', `
    A: a=ID ({infer B} b=ID ({infer C} c=ID)?)? d=ID;
	D: E ({infer D.e=current} d=ID)?;
    E: e=ID;
    F: value=ID ({infer F.item=current} value=ID)*;
    G: ({X} x=ID | {Y} y=ID | {Z} z=ID) {infer G.front=current} back=ID;

    Entry:
	    Expr;
    Expr:
        {Ref} ref=ID
        ({Access.receiver=current} '.' member=ID)*;
    Ref:
        {Ref} ref=ID;
    Access:
        {Access} '.' member=ID;

    terminal ID returns string: /string/;
`, types => {

    test('Entry is inferred as a union type', () => {
        const entry = getType(types, 'Entry') as UnionType;
        expect(entry).toBeDefined();
        expectUnion(entry, [{
            array: false,
            reference: false,
            types: ['Expr']
        }]);
    });

    test('Expr is inferred as a union type', () => {
        const expr = getType(types, 'Expr') as UnionType;
        expect(expr).toBeDefined();
        expectUnion(expr, [{
            array: false,
            reference: false,
            types: ['Ref', 'Access']
        }]);
    });

    test('Ref is inferred as ref:string', () => {
        const ref = getType(types, 'Ref') as InterfaceType;
        expect(ref).toBeDefined();
        expect(ref.interfaceSuperTypes).toHaveLength(0);
        expect(ref.properties).toHaveLength(1);
        expectProperty(ref, {
            name: 'ref',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['string']
            }]
        });
    });

    test('Access is inferred as receiver:Ref, member:string', () => {
        const access = getType(types, 'Access') as InterfaceType;
        expect(access).toBeDefined();
        expect(access.interfaceSuperTypes).toHaveLength(0);
        expect(access.properties).toHaveLength(2);
        expectProperty(access, {
            name: 'receiver',
            optional: true,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['Ref']
            }]
        });
        expectProperty(access, {
            name: 'member',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['string']
            }]
        });
    });

    test('A is inferred with a:string, d:string', () => {
        const a = getType(types, 'A') as InterfaceType;
        expect(a).toBeDefined();
        expect(a.interfaceSuperTypes).toHaveLength(0);
        expect(a.properties).toHaveLength(2);
        expectProperty(a, 'a');
        expectProperty(a, 'd');
    });

    test('B is inferred with super type A and a:string, b:string, d:string', () => {
        const b = getType(types, 'B') as InterfaceType;
        expect(b).toBeDefined();
        expect(b.interfaceSuperTypes).toEqual(['A']);
        expect(b.properties).toHaveLength(3);
        expectProperty(b, 'a');
        expectProperty(b, 'b');
        expectProperty(b, 'd');
    });

    test('C is inferred with super type B and a:string, b:string, c:string d:string', () => {
        const c = getType(types, 'C') as InterfaceType;
        expect(c).toBeDefined();
        expect(c.interfaceSuperTypes).toEqual(['B']);
        expect(c.properties).toHaveLength(4);
        expectProperty(c, 'a');
        expectProperty(c, 'b');
        expectProperty(c, 'c');
        expectProperty(c, 'd');
    });

    test('D is inferred with e:E, d:string', () => {
        const d = getType(types, 'D') as InterfaceType;
        expect(d).toBeDefined();
        expect(d.interfaceSuperTypes).toHaveLength(0);
        expect(d.properties).toHaveLength(2);
        expectProperty(d, {
            name: 'e',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['E']
            }]
        });
        expectProperty(d, 'd');
    });

    test('E is inferred with super type D and property e', () => {
        const e = getType(types, 'E') as InterfaceType;
        expect(e).toBeDefined();
        expect(e.interfaceSuperTypes).toEqual(['D']);
        expect(e.properties).toHaveLength(1);
        expectProperty(e, 'e');
    });

    test('F is inferred with value:string, item?:F', () => {
        const f = getType(types, 'F') as InterfaceType;
        expect(f).toBeDefined();
        expect(f.interfaceSuperTypes).toHaveLength(0);
        expect(f.properties).toHaveLength(2);
        expectProperty(f, 'value');
        expectProperty(f, {
            name: 'item',
            optional: true,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['F']
            }]
        });
    });

    test('G is inferred with front:(X|Y|Z), back:string', () => {
        const G = getType(types, 'G') as InterfaceType;
        expect(G).toBeDefined();
        expect(G.interfaceSuperTypes).toHaveLength(0);
        expect(G.properties).toHaveLength(2);
        expectProperty(G, {
            name: 'front',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['X', 'Y', 'Z']
            }]
        });
    });

    test('X, Y, Z are inferred from G as simple types', () => {
        const x = getType(types, 'X') as InterfaceType;
        expect(x).toBeDefined();
        expect(x.interfaceSuperTypes).toEqual(['G']);
        expect(x.properties).toHaveLength(1);
        expectProperty(x, 'x');
        const y = getType(types, 'Y') as InterfaceType;
        expect(y).toBeDefined();
        expect(x.interfaceSuperTypes).toEqual(['G']);
        expect(y.properties).toHaveLength(1);
        expectProperty(y, 'y');
        const z = getType(types, 'Z') as InterfaceType;
        expect(z).toBeDefined();
        expect(x.interfaceSuperTypes).toEqual(['G']);
        expect(z.properties).toHaveLength(1);
        expectProperty(z, 'z');
    });

});

describeTypes('inferred types with common names', `
    A infers X: a=ID;
	B infers X: a=ID b=ID;
    C infers X: a=ID c=ID?;

    terminal ID returns string: /string/;
`, types => {
    test('X is inferred with a:string, b?:string, c?:string', () => {
        const x = getType(types, 'X') as InterfaceType;
        expect(x).toBeDefined();
        expect(x.interfaceSuperTypes).toHaveLength(0);
        expect(x.properties).toHaveLength(3);
        expectProperty(x, 'a');
        expectProperty(x, {
            name: 'b',
            optional: true,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['string']
            }]
        });
        expectProperty(x, {
            name: 'c',
            optional: true,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['string']
            }]
        });
    });

    test('A, B, C are not inferred', () => {
        const a = getType(types, 'A') as InterfaceType;
        expect(a).toBeUndefined();
        const b = getType(types, 'B') as InterfaceType;
        expect(b).toBeUndefined();
        const c = getType(types, 'C') as InterfaceType;
        expect(c).toBeUndefined();
    });

});

describeTypes('inferred types with common names and actions', `
    A infers X: {infer A} a=ID;
	B infers X: {infer B} b=ID;

    C: D ({infer C.item=current} value=ID); 
    D infers Y: y=ID;

    terminal ID returns string: /string/;
`, types => {
    test('A is inferred with a:string', () => {
        const a = getType(types, 'A') as InterfaceType;
        expect(a).toBeDefined();
        // Since 'X' is not an actual type (but a union), it is removed as a super type.
        expect(a.interfaceSuperTypes).toHaveLength(0);
        expect(a.properties).toHaveLength(1);
        expectProperty(a, 'a');
    });

    test('B is inferred with b:string', () => {
        const b = getType(types, 'B') as InterfaceType;
        expect(b).toBeDefined();
        // Since 'X' is not an actual type (but a union), it is removed as a super type.
        expect(b.interfaceSuperTypes).toHaveLength(0);
        expect(b.properties).toHaveLength(1);
        expectProperty(b, 'b');
    });

    test('X is inferred as A | B', () => {
        const x = getType(types, 'X') as UnionType;
        expect(x).toBeDefined();
        expectUnion(x, [{
            array: false,
            reference: false,
            types: ['A', 'B']
        }]);
    });

    test('C is inferred with super type Y and properties item:Y, value:ID', () => {
        const c = getType(types, 'C') as InterfaceType;
        expect(c).toBeDefined();
        expect(c.interfaceSuperTypes).toHaveLength(0);
        expect(c.properties).toHaveLength(2);
        expectProperty(c, 'value');
        expectProperty(c, {
            name: 'item',
            optional: false,
            typeAlternatives: [{
                array: false,
                reference: false,
                types: ['Y']
            }]
        });
    });

    test('Y is inferred from D with y:ID', () => {
        const y = getType(types, 'Y') as InterfaceType;
        expect(y).toBeDefined();
        expect(y.interfaceSuperTypes).toEqual(['C']);
        expect(y.properties).toHaveLength(1);
        expectProperty(y, 'y');
    });

    test('D is not inferred', () => {
        const d = getType(types, 'D');
        expect(d).toBeUndefined();
    });

});

async function getTypes(grammar: string): Promise<AstTypes> {
    const services = createLangiumGrammarServices().grammar;
    const helper = parseHelper<Grammar>(services);
    const result = await helper(grammar);
    const gram = result.parseResult.value;
    const rules = gram.rules.filter(isParserRule);
    const datatypeRules = rules.filter(e => isDataTypeRule(e));
    const parserRules = rules.filter(e => !isDataTypeRule(e));
    return collectInferredTypes(parserRules, datatypeRules);
}

function getType(types: AstTypes, name: string): InterfaceType | UnionType | undefined {
    const interfaceType = types.interfaces.find(e => e.name === name);
    const unionType = types.unions.find(e => e.name === name);
    return interfaceType || unionType;
}

function expectProperty(interfaceType: InterfaceType, property: Property | string): void {
    if (typeof property === 'string') {
        const prop = interfaceType.properties.find(e => e.name === property)!;
        expect(prop).toBeDefined();
        expect(prop.optional).toStrictEqual(false);
    } else {
        const prop = interfaceType.properties.find(e => e.name === property.name)!;
        expect(prop).toBeDefined();
        expect(prop.optional).toStrictEqual(property.optional);
        expect(prop.typeAlternatives.length).toStrictEqual(property.typeAlternatives.length);
        for (let i = 0; i < prop.typeAlternatives.length; i++) {
            const actualType = prop.typeAlternatives[i];
            const expectedType = property.typeAlternatives[i];
            expect(actualType.types).toEqual(expectedType.types);
            expect(actualType.array).toEqual(expectedType.array);
            expect(actualType.reference).toEqual(expectedType.reference);
        }
    }
}

function expectUnion(unionType: UnionType, types: PropertyType[]): void {
    expect(unionType.union.length).toStrictEqual(types.length);
    for (let i = 0; i < unionType.union.length; i++) {
        const actualType = unionType.union[i];
        const expectedType = types[i];
        expect(actualType.types).toEqual(expectedType.types);
        expect(actualType.array).toEqual(expectedType.array);
        expect(actualType.reference).toEqual(expectedType.reference);
    }
}
