/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import type { AstNode, AstNodeTypesWithCrossReferences, AstTypeList, CrossReferencesOfAstNodeType, Reference } from '../src/syntax-tree.js';

describe('Utility types revealing cross-reference properties', () => {

    /**
     * The tests listed below don't check correctness of 'CrossReferencesOfAstNodeType'
     *  and 'AstNodeTypesWithCrossReferences' by executing code and comparing results.
     * Instead, they check if the types are correctly inferred by TypeScript.
     *
     * Hence, test failure are indicated by TypeScript errors, while the absence of any compile errors denotes success.
     *
     * Note: a value of type 'never' can be assigned to any other type, but not vice versa.
     * In order to make sure 'never' _is not_ derived where they shouldn't be, esp. for the 'props' variables, 'props.length' is used.
     * In order to make sure 'never' _is_ derived where it should be, the function 'checkNever' defined below is used.
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
    const checkNever =           (props: never)                => props;

    test('Should not reveal cross-ref properties for NoRefs', () => {
        const props = getCrossRefProps(<NoRefs>{});
        checkNever(props);
    });

    test('Should reveal cross-ref properties for SingleRef', () => {
        const props = getCrossRefProps(<SingleRef>{});
        switch (props) {
            case 'singleRef':
                return props.length;
            default:
                return checkNever(props);
        }
    });

    test('Should reveal cross-ref properties for OptionalSingleRef', () => {
        const props = getCrossRefProps(<OptionalSingleRef>{});
        switch (props) {
            case 'optionalSingleRef':
                return props.length;
            default:
                return checkNever(props);
        }
    });

    test('Should reveal cross-ref properties for MultiRef', () => {
        const props = getCrossRefProps(<MultiRef>{});
        switch (props) {
            case 'multiRef':
                return props.length;
            default:
                return checkNever(props);
        }
    });

    test('Should reveal cross-ref properties for OptionalMultiRef', () => {
        const props = getCrossRefProps(<OptionalMultiRef>{});
        switch (props) {
            case 'optionalMultiRef':
                return props.length;
            default:
                return checkNever(props);
        }
    });

    test('Should reveal AST Types with cross-references', () => {
        const instance = getAnyInstanceOfType<PlainAstTypes>();
        switch (instance.$type) {
            case 'SingleRef':
            case 'OptionalSingleRef':
            case 'MultiRef':
            case 'OptionalMultiRef':
                return instance.$type;
            default:
                return checkNever(instance);
        }
    });

    test('Should reveal AST Types and their cross-references', () => {
        const instance = getAnyInstanceOfType<PlainAstTypes>();
        switch (instance.$type) {
            case 'SingleRef': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'singleRef':
                        return props.length;
                    default:
                        return checkNever(props);
                }
            }
            case 'OptionalSingleRef': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'optionalSingleRef':
                        return props.length;
                    default:
                        return checkNever(props);
                }
            }
            case 'MultiRef': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'multiRef':
                        return props.length;
                    default:
                        return checkNever(props);
                }
            }
            case 'OptionalMultiRef': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'optionalMultiRef':
                        return props.length;
                    default:
                        return checkNever(props);
                }
            }
            default: {
                checkNever(instance);
                return checkNever(getCrossRefProps(instance));
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
                        return props.length;
                    default: {
                        return checkNever(props);
                    }
                }
            }
            case 'OptionalSingleRefEx': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'optionalSingleRefEx':
                        return props.length;
                    default: {
                        return checkNever(props);
                    }
                }
            }
            case 'MultiRefEx': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'multiRefEx':
                        return props.length;
                    default: {
                        return checkNever(props);
                    }
                }
            }
            case 'OptionalMultiRefEx': {
                const props = getCrossRefProps(instance);
                switch (props) {
                    case 'optionalMultiRefEx':
                        return props.length;
                    default: {
                        return checkNever(props);
                    }
                }
            }
            default: {
                checkNever(instance);
                return checkNever(getCrossRefProps(instance));
            }
        }
    });
});