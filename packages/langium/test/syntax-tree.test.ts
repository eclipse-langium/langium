/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expectTypeOf, test } from 'vitest';
import type { AstNode, AstNodeTypesWithCrossReferences, AstTypeList, CrossReferencesOfAstNodeType, Reference } from '../src/syntax-tree.js';

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
