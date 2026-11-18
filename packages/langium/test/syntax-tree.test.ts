/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, expectTypeOf, test } from 'vitest';
import type { AstMetaData, AstNode, AstNodeTypesWithCrossReferences, AstTypeList, CrossReferencesOfAstNodeType, Reference } from '../src/syntax-tree.js';
import { AbstractAstReflection } from '../src/syntax-tree.js';

describe('Utility types revealing cross-reference properties', () => {

    /**
     * The tests listed below don't check correctness of 'CrossReferencesOfAstNodeType'
     *  and 'AstNodeTypesWithCrossReferences' by executing code and comparing results.
     * Instead, they check if the types are correctly inferred by TypeScript.
     *
     * Hence, test failure are indicated by TypeScript errors, while the absence of any compile errors denotes success.
     * Note: a value of type 'never' can be assigned to any other type, but not vice versa.
     */

    // below follow some type definitions as produced by the Langium generator

    interface NoRefs extends AstNode {
        $type: 'NoRefs';
        name: string;
    }

    interface SingleRef extends AstNode {
        $type: 'SingleRef';
        singleRef: Reference<NoRefs>;
    }

    interface OptionalSingleRef extends AstNode {
        $type: 'OptionalSingleRef';
        optionalSingleRef?: Reference<NoRefs>;
    }

    interface MultiRef extends AstNode {
        $type: 'MultiRef';
        multiRef: Array<Reference<NoRefs>>;
    }

    interface OptionalMultiRef extends AstNode {
        $type: 'OptionalMultiRef';
        optionalMultiRef?: Array<Reference<NoRefs>>;
    }

    type PlainAstTypes = {
        NoRefs: NoRefs,
        SingleRef: SingleRef,
        OptionalSingleRef: OptionalSingleRef,
        MultiRef: MultiRef,
        OptionalMultiRef: OptionalMultiRef
    }

    const getAnyInstanceOfType = <T extends AstTypeList<T>>()  => <AstNodeTypesWithCrossReferences<T>>{};
    const getCrossRefProps =     <T extends AstNode>(_type: T) => <CrossReferencesOfAstNodeType<T>>'';

    test('Should not reveal cross-ref properties for NoRefs', () => {
        const props = getCrossRefProps(<NoRefs>{});
        expectTypeOf(props).toBeNever();
    });

    test('Should reveal cross-ref properties for SingleRef', () => {
        const props = getCrossRefProps(<SingleRef>{});
        switch (props) {
            case 'singleRef':
                return expectTypeOf(props).toEqualTypeOf<'singleRef'>;
            default:
                return expectTypeOf(props).toBeNever();
        }
    });

    test('Should reveal cross-ref properties for OptionalSingleRef', () => {
        const props = getCrossRefProps(<OptionalSingleRef>{});
        switch (props) {
            case 'optionalSingleRef':
                return expectTypeOf(props).toEqualTypeOf<'optionalSingleRef'>;
            default:
                return expectTypeOf(props).toBeNever();
        }
    });

    test('Should reveal cross-ref properties for MultiRef', () => {
        const props = getCrossRefProps(<MultiRef>{});
        switch (props) {
            case 'multiRef':
                return expectTypeOf(props).toEqualTypeOf<'multiRef'>;
            default:
                return expectTypeOf(props).toBeNever();
        }
    });

    test('Should reveal cross-ref properties for OptionalMultiRef', () => {
        const props = getCrossRefProps(<OptionalMultiRef>{});
        switch (props) {
            case 'optionalMultiRef':
                return expectTypeOf(props).toEqualTypeOf<'optionalMultiRef'>;
            default:
                return expectTypeOf(props).toBeNever();
        }
    });

    test('Should reveal AST Types with cross-references', () => {
        const instance = getAnyInstanceOfType<PlainAstTypes>();
        switch (instance.$type) {
            case 'SingleRef':
            case 'OptionalSingleRef':
            case 'MultiRef':
            case 'OptionalMultiRef':
                expectTypeOf(instance).toEqualTypeOf<SingleRef | OptionalSingleRef | MultiRef | OptionalMultiRef>();

                return expectTypeOf(instance.$type).toEqualTypeOf<'SingleRef' | 'OptionalSingleRef' | 'MultiRef' | 'OptionalMultiRef'>();
            default:
                return expectTypeOf(instance).toBeNever();
        }
    });

    test('Should reveal AST Types and their cross-references', () => {
        const instance = getAnyInstanceOfType<PlainAstTypes>();
        switch (instance.$type) {
            case 'SingleRef': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'singleRef':
                        return expectTypeOf(props).toEqualTypeOf<'singleRef'>;
                    default:
                        return expectTypeOf(props).toBeNever();
                }
            }
            case 'OptionalSingleRef': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'optionalSingleRef':
                        return expectTypeOf(props).toEqualTypeOf<'optionalSingleRef'>;
                    default:
                        return expectTypeOf(props).toBeNever();
                }
            }
            case 'MultiRef': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'multiRef':
                        return expectTypeOf(props).toEqualTypeOf<'multiRef'>;
                    default:
                        return expectTypeOf(props).toBeNever();
                }
            }
            case 'OptionalMultiRef': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'optionalMultiRef':
                        return expectTypeOf(props).toEqualTypeOf<'optionalMultiRef'>;
                    default:
                        return expectTypeOf(props).toBeNever();
                }
            }
            default: {
                expectTypeOf(instance).toBeNever();
                expectTypeOf(getCrossRefProps(instance)).toBeNever();
                return;
            }
        }
    });

    interface SuperType extends AstNode {
        readonly $type: 'SingleRefEx' | 'OptionalSingleRefEx'
    }

    interface SingleRefEx extends SuperType {
        readonly $type: 'SingleRefEx';
        singleRefEx: Reference<NoRefs>;
    }

    interface OptionalSingleRefEx extends SuperType {
        readonly $type: 'OptionalSingleRefEx';
        optionalSingleRefEx?: Reference<NoRefs>;
    }

    interface SuperTypeIncludingNoRef extends AstNode {
        readonly $type: 'NoRefsEx' | 'MultiRefEx' | 'OptionalMultiRefEx';
    }

    interface NoRefsEx extends SuperTypeIncludingNoRef {
        readonly $type: 'NoRefsEx';
        name: string;
    }

    interface MultiRefEx extends SuperTypeIncludingNoRef {
        readonly $type: 'MultiRefEx';
        multiRefEx: Array<Reference<NoRefs>>;
    }

    interface OptionalMultiRefEx extends SuperTypeIncludingNoRef {
        readonly $type: 'OptionalMultiRefEx';
        optionalMultiRefEx?: Array<Reference<NoRefs>>;
    }

    type TypesAndCommonSuperAstTypes = {
        SuperType: SuperType,
        SingleRefEx: SingleRefEx,
        OptionalSingleRefEx: OptionalSingleRefEx,

        SuperTypeIncludingNoRef: SuperTypeIncludingNoRef
        NoRefsEx: NoRefsEx,
        MultiRefEx: MultiRefEx,
        OptionalMultiRefEx: OptionalMultiRefEx,
    }

    test('Should reveal AST Types inheriting common super types and their cross-references.', () => {
        const instance = getAnyInstanceOfType<TypesAndCommonSuperAstTypes>();
        switch (instance.$type) {
            case 'SingleRefEx': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'singleRefEx':
                        return expectTypeOf(props).toEqualTypeOf<'singleRefEx'>;
                    default: {
                        return expectTypeOf(props).toBeNever();
                    }
                }
            }
            case 'OptionalSingleRefEx': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'optionalSingleRefEx':
                        return expectTypeOf(props).toEqualTypeOf<'optionalSingleRefEx'>;
                    default: {
                        return expectTypeOf(props).toBeNever();
                    }
                }
            }
            case 'MultiRefEx': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'multiRefEx':
                        return expectTypeOf(props).toEqualTypeOf<'multiRefEx'>;
                    default: {
                        return expectTypeOf(props).toBeNever();
                    }
                }
            }
            case 'OptionalMultiRefEx': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'optionalMultiRefEx':
                        return expectTypeOf(props).toEqualTypeOf<'optionalMultiRefEx'>;
                    default: {
                        return expectTypeOf(props).toBeNever();
                    }
                }
            }
            default: {
                expectTypeOf(instance).toBeNever();
                expectTypeOf(getCrossRefProps(instance)).toBeNever();
                return;
            }
        }
    });
});

describe('AbstractAstReflection.isSubtype', () => {

    // D is a diamond (B and C both extend A), E extends D, and F declares a super type that has no meta data.
    class TestReflection extends AbstractAstReflection {
        override readonly types: AstMetaData = {
            A: { name: 'A', properties: {}, superTypes: [] },
            B: { name: 'B', properties: {}, superTypes: ['A'] },
            C: { name: 'C', properties: {}, superTypes: ['A'] },
            D: { name: 'D', properties: {}, superTypes: ['B', 'C'] },
            E: { name: 'E', properties: {}, superTypes: ['D'] },
            F: { name: 'F', properties: {}, superTypes: ['Unknown'] }
        };

        get cache(): Record<string, Record<string, boolean | undefined>> {
            return this.subtypes;
        }
    }

    const expectedSupertypes: Record<string, string[]> = {
        A: ['A'],
        B: ['B', 'A'],
        C: ['C', 'A'],
        D: ['D', 'B', 'C', 'A'],
        E: ['E', 'D', 'B', 'C', 'A'],
        F: ['F', 'Unknown'],
        Unknown: ['Unknown'],
        NotAType: ['NotAType']
    };
    const candidates = Object.keys(expectedSupertypes);

    test('agrees with the transitive closure of the declared super types, on cache misses and hits', () => {
        const reflection = new TestReflection();
        // The first round computes and caches every pair, the second round answers from the cache.
        for (let round = 0; round < 2; round++) {
            for (const subtype of candidates) {
                for (const supertype of candidates) {
                    const expected = expectedSupertypes[subtype].includes(supertype);
                    expect(reflection.isSubtype(subtype, supertype), `round ${round}: isSubtype(${subtype}, ${supertype})`).toBe(expected);
                }
            }
        }
    });

    test('caches the result of every pair it computes', () => {
        const reflection = new TestReflection();
        expect(reflection.isSubtype('E', 'C')).toBe(true);
        // B is checked before C, so the walk visits E, D, B and A; the identity C === C is not cached.
        expect(reflection.cache).toEqual({
            E: { C: true },
            D: { C: true },
            B: { C: false },
            A: { C: false }
        });

        expect(reflection.isSubtype('F', 'A')).toBe(false);
        expect(reflection.isSubtype('NotAType', 'A')).toBe(false);
        expect(reflection.cache).toMatchObject({
            F: { A: false },
            Unknown: { A: false },
            NotAType: { A: false }
        });
    });

    test('answers from the cache once a pair is cached', () => {
        const reflection = new TestReflection();
        expect(reflection.isSubtype('B', 'C')).toBe(false);
        reflection.cache.B.C = true;
        expect(reflection.isSubtype('B', 'C')).toBe(true);
    });
});
