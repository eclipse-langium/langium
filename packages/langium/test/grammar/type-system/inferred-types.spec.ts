/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstTypes, createLangiumGrammarServices, Grammar, InterfaceType, isDataTypeRule, isParserRule, Property, PropertyType, UnionType } from '../../../src';
import { collectInferredTypes } from '../../../src/grammar/type-system/inferred-types';
import { parseHelper } from '../../../src/test';

interface TypeContainer {
    types: AstTypes;
}

function describeTypes(name: string, grammar: string, description: (this: TypeContainer) => void | Promise<void>): void {
    describe(name, () => {
        const container: TypeContainer = {
            types: {
                interfaces: [],
                unions: []
            }
        };
        beforeAll(async () => {
            container.types = await getTypes(grammar);
        });
        description.call(container);
    });
}

describeTypes('inferred types of simple grammars', `
    A: name=ID value=NUMBER?;
    B: name=FQN values+=NUMBER;
    C: 'c' ref=[A];

    FQN: ID;
    terminal ID returns string: /string/;
    terminal NUMBER returns number: /number/;
`, function() {
    test('A is inferred with name:string and value?:number', () => {
        const a = getType(this.types, 'A') as InterfaceType;
        expect(a).toBeTruthy();
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
        const b = getType(this.types, 'B') as InterfaceType;
        expect(b).toBeTruthy();
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
        const c = getType(this.types, 'C') as InterfaceType;
        expect(c).toBeTruthy();
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
        const fqn = getType(this.types, 'FQN') as UnionType;
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
    D: name=ID | value=NUMBER;

    terminal ID returns string: /string/;
    terminal NUMBER returns number: /number/;
`, function() {
    test('A is inferred with name:(string)|(number)', () => {
        const a = getType(this.types, 'A') as InterfaceType;
        expect(a).toBeTruthy();
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
        const b = getType(this.types, 'B') as InterfaceType;
        expect(b).toBeTruthy();
        expectProperty(b, {
            name: 'name',
            optional: false,
            typeAlternatives: [
                {
                    array: false,
                    reference: false,
                    types: ['number', 'string']
                }
            ]
        });
    });

    test('C is inferred as union type A | B', () => {
        const c = getType(this.types, 'C') as UnionType;
        expect(c).toBeTruthy();
        expectUnion(c, [{
            array: false,
            reference: false,
            types: ['A', 'B']
        }]);
    });

    test('D is inferred with name?:string, value?: number', () => {
        const d = getType(this.types, 'D') as InterfaceType;
        expect(d).toBeTruthy();
        expectProperty(d, {
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
        expectProperty(d, {
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

function expectProperty(interfaceType: InterfaceType, property: Property): void {
    const prop = interfaceType.properties.find(e => e.name === property.name)!;
    expect(prop).toBeTruthy();
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
