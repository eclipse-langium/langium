/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import type { AstNode, Reference } from 'langium';
import { AstUtils, EmptyFileSystem, GrammarAST } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';

interface TestNode extends AstNode {
    readonly $type: 'MyType';
    readonly $container?: TestNode;
    str: string;
    strArr: string[]
    optStr?: string;
    optStrArr?: string[];
    bool: boolean;
    boolArr: boolean[];
    optBool?: boolean;
    optBoolArr?: boolean[];
    int: number;
    intArr: number[];
    optInt?: number;
    optIntArr?: number[];
    ref: Reference<TestNode>;
    refArr: Array<Reference<TestNode>>;
    optRef?: Reference<TestNode>;
    optRefArr?: Array<Reference<TestNode>>;
    ctn: TestNode;
    ctnArr: TestNode[];
    optCtn?: TestNode;
    optCtnArr?: PartialTestNode[];
}

interface PartialTestNode extends AstNode {
    readonly $type: 'MyType';
    readonly $container?: PartialTestNode;
    str?: string;
    strArr: string[]
    optStr?: string;
    optStrArr?: string[];
    bool: boolean;
    boolArr: boolean[];
    optBool?: boolean;
    optBoolArr?: boolean[];
    int?: number;
    intArr: number[];
    optInt?: number;
    optIntArr?: number[];
    ref?: Reference<PartialTestNode>;
    refArr: Array<Reference<PartialTestNode>>;
    optRef?: Reference<PartialTestNode>;
    optRefArr?: Array<Reference<PartialTestNode>>;
    ctn?: PartialTestNode;
    ctnArr: PartialTestNode[];
    optCtn?: PartialTestNode;
    optCtnArr?: PartialTestNode[];
}
export const expectType = <Type>(_: Type): void => void 0;

describe('AST Utils', () => {

    test('Streaming ast works with range', () => {
        const services = createLangiumGrammarServices(EmptyFileSystem);
        const parseResult = services.grammar.parser.LangiumParser.parse(`Before: 'before';
        OverlapBefore:
            'before';
        Inside: 'inside';
        OverlapAfter:
            'after';
        After: 'after';
        `);
        const options = {
            range: {
                start: {
                    line: 2,
                    character: 0
                },
                end: {
                    line: 5,
                    character: 0
                }
            }
        };
        const names: string[] = [];
        for (const node of AstUtils.streamAst(parseResult.value, options)) {
            if (GrammarAST.isParserRule(node)) {
                names.push(node.name);
            }
        }
        expect(names).toEqual(['OverlapBefore', 'Inside', 'OverlapAfter']);
    });

    test('should transform DeepPartialAstNode<TestNode> to PartialTestNode', () => {
        type ResultType = AstUtils.DeepPartialAstNode<TestNode>;
        expectType<PartialTestNode>((null as unknown) as ResultType);
        expectType<ResultType>((null as unknown) as PartialTestNode);
    });

    test('copyAstNode with trace should add all involved ast nodes to trace', () => {
        interface MyType extends AstNode {
            readonly $type: 'MyType';
            name?: string;
            singleChild?: MyType;
            children?: MyType[];
            buddy?: Reference<MyType>;
        }

        const root: MyType = {
            $type: 'MyType',
            name: 'root',
            singleChild: {
                $type: 'MyType',
                name: 'singleChild',
            },
            children: [
                {
                    $type: 'MyType',
                    name: 'child1',
                    buddy: {
                        $refText: 'child2',
                        get ref() { return root.children?.[1]; },
                    }
                },
                {
                    $type: 'MyType',
                    name: 'child2',
                    buddy: {
                        $refText: 'child1',
                        get ref() { return root.children?.[0]; },
                    }
                }
            ]
        };

        const trace = new Map<AstNode, AstNode>();

        // a simple reference builder function that identifies the to be referenced nodes
        //  based on the trace map and the original reference
        // this approach might not work in general because of project-specific details
        //  but it nicely illustrates the utility of the trace map and also checks it's proper population
        const buildReference: Parameters<typeof AstUtils.copyAstNode>['1'] = (_, _1, _2, _3, origRef) => ({
            ...origRef,
            get ref() { return origRef.ref && trace.get(origRef.ref); }
        });

        const copy = AstUtils.copyAstNode(root, buildReference, trace);

        expect(trace.get(root)).toBe(copy);
        expect(trace.get(copy)).toBe(root);

        expect(trace.get(root.singleChild!)).toBe(copy.singleChild);
        expect(trace.get(copy.singleChild!)).toBe(root.singleChild);

        expect(trace.get(root.children![0])).toBe(copy.children![0]);
        expect(trace.get(copy.children![0])).toBe(root.children![0]);

        expect(trace.get(root.children![1])).toBe(copy.children![1]);
        expect(trace.get(copy.children![1])).toBe(root.children![1]);

        expect(copy.children![1].buddy!.ref).toBe(copy.children![0]);
        expect(copy.children![0].buddy!.ref).toBe(copy.children![1]);
    });
});
