/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import type { AstNode, Reference } from 'langium';
import { AstUtils, EmptyFileSystem, GrammarAST } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expectType } from 'ts-expect';

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
});
