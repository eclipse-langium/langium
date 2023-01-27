/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { beforeAll, describe, expect, test } from 'vitest';
import { toStringAndTrace, traceToNode } from '../../src/generator/generator-node';
import { TraceRegion } from '../../src/generator/generator-tracing';
import { expandToNode, expandTracedToNode, joinTracedToNode } from '../../src/generator/template-node';
import { AstNodeWithTextRegion } from '../../src/serializer/json-serializer';
import type { AstNode } from '../../src/syntax-tree';
import { parseHelper } from '../../src/test';
import { createServicesForGrammar } from '../../src/utils/grammar-util';
import { TreeStreamImpl } from '../../src/utils/stream';

let parse: (text: string) => Promise<AstNode>;
let parse2: (text: string) => Promise<AstNode>;
beforeAll(async () => {
    const container = await createServicesForGrammar({
        grammar: `
            grammar Test
            entry Main: ('name=' name=ID)? values+=(ID|STRING|NUMBER)+ ('children' '{' children+=Main+ '}')?;

            terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
            terminal NUMBER returns number: /([0-9]+)(\\.[0-9]+)?/;
            terminal STRING: /"[^"]*"|'[^']*'/;
            hidden terminal WS: /\\s+/;
        `,
        parserConfig: {
            maxLookahead: 3
        }
    });
    const serializer = container.serializer.JsonSerializer;

    parse = async (text: string) => (await parseHelper(container)(text)).parseResult.value;
    parse2 = relyingOn$cstNode
        ? parse
        : async (text: string) => serializer.deserialize(
            serializer.serialize(
                await parse(text),
                { textRegions: true }
            )
        );
});

function persistSourceRegions(trace: TraceRegion): TraceRegion {
    // simplifies trace mismatch investigation
    new TreeStreamImpl(trace, tr => tr?.children ?? [], { includeRoot: true }).forEach(
        tr => tr.sourceRegion = tr.sourceRegion && {
            offset: tr.sourceRegion.offset,
            length: tr.sourceRegion.length,
            fileURI: tr.sourceRegion?.fileURI
        }
    );
    return trace;
}

// the vscode vitest extension doesn't support describe.each() (or any other tweak I could imagine) that is a real pity,
//  so we need to manually flip this flag if we want to test '$textRegion' version
const relyingOn$cstNode = false;
describe('tracing using $cstNode or $textRegion', () => {
    function documentURI(root: AstNodeWithTextRegion) {
        return relyingOn$cstNode ? root.$document?.uri?.toString() : root.$textRegion?.documentURI;
    }

    test('should trace single node spanning the entire output', async () => {
        const source = await parse2('AH "IH" OH');
        const { text, trace } = toStringAndTrace(
            expandTracedToNode(source)`
                beginning ... end
            `
        );
        // persistSourceRegions(trace);

        expect( text ).toBe('beginning ... end');
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 17 },
        });
    });

    test('should trace single node to nested regions spanning the entire output', async () => {
        const source = await parse2('AH "IH" OH');
        const { text, trace } = toStringAndTrace(
            expandTracedToNode(source)`
                ${ expandTracedToNode(source)`
                    beginning ... end
                ` }
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('beginning ... end');
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 17 },
            children: [ {
                sourceRegion: { offset: 0, length: 10, fileURI: undefined },
                targetRegion: { offset: 0, length: 17 },
            } ]
        });
    });

    test('should trace single node with preamble in output 1', async () => {
        const source = await parse2('AH "IH" OH');
        const { text, trace } = toStringAndTrace(
            expandToNode`
                Preamble; 
            `.appendTraced(source)(
                'beginning ... end' // eslint-disable-line @typescript-eslint/indent
            )                       // eslint-disable-line @typescript-eslint/indent
        );
        // persistSourceRegions(trace);

        expect( text ).toBe('Preamble; beginning ... end');
        expect( trace ).toMatchObject( <TraceRegion>{
            targetRegion: { offset: 0, length: 27 },
            children: [ {
                sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
                targetRegion: { offset: 10, length: 17 }
            } ]
        });
    });

    test('should trace single node with preamble in output 2', async () => {
        const source = await parse2('AH "IH" OH');
        const { text, trace } = toStringAndTrace(
            expandToNode`
                Preamble; 
            `.appendTracedTemplate(source)`
                beginning ... end
            `
        );
        // persistSourceRegions(trace);

        expect( text ).toBe('Preamble; beginning ... end');
        expect( trace ).toMatchObject( <TraceRegion>{
            targetRegion: { offset: 0, length: 27 },
            children: [ {
                sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
                targetRegion: { offset: 10, length: 17 }
            } ]
        });
    });

    test('should trace property value within single node spanning the entire output 1', async () => {
        const source = await parse2('name=foo AH "IH" OH') as AstNode & { name: string };
        const { text, trace } = toStringAndTrace(
            expandTracedToNode(source)`
                beginning ${ traceToNode(source, 'name')(source.name) } end
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('beginning foo end');
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 19, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 17 },
            children: [ {
                sourceRegion: { offset: 5, length: 3, fileURI: undefined },
                targetRegion: { offset: 10, length: 3}
            } ]
        });
    });

    test('should trace property value only 1', async () => {
        const source = await parse2('name=foo AH "IH" OH') as AstNode & { name: string };
        const { text, trace } = toStringAndTrace(
            expandToNode`
                beginning ${ traceToNode(source, 'name')(source.name) } end
            `
        );
        // persistSourceRegions(trace);

        expect( text ).toBe('beginning foo end');
        expect( trace ).toMatchObject( <TraceRegion>{
            targetRegion: { offset: 0, length: 17 },
            children: [ {
                sourceRegion: { offset: 5, length: 3, fileURI: documentURI(source) },
                targetRegion: { offset: 10, length: 3}
            } ]
        });
    });

    test('should trace property value only 2', async () => {
        const source = await parse2('name=foo AH "IH" OH') as AstNode & { name: string };
        const { text, trace } = toStringAndTrace(
            expandToNode`
                beginning ${ expandTracedToNode(source, 'name')`${source.name}` } end
            `
        );
        // persistSourceRegions(trace);

        expect( text ).toBe('beginning foo end');
        expect( trace ).toMatchObject( <TraceRegion>{
            targetRegion: { offset: 0, length: 17 },
            children: [ {
                sourceRegion: { offset: 5, length: 3, fileURI: documentURI(source) },
                targetRegion: { offset: 10, length: 3}
            } ]
        });
    });

    test('should trace single list value within single node spanning the entire output', async () => {
        const source = await parse2('AH "IH" OH') as AstNode & { values: string[] };
        const { text, trace } = toStringAndTrace(
            expandTracedToNode(source)`
                beginning ${ traceToNode(source, 'values', 1)(source.values[1]) } end
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('beginning IH end');
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 16 },
            children: [ {
                sourceRegion: { offset: 3, length: 4, fileURI: undefined },
                targetRegion: { offset: 10, length: 2}
            } ]
        });
    });

    test('should trace single list value only', async () => {
        const source = await parse2('AH "IH" OH') as AstNode & { values: string[] };
        const { text, trace } = toStringAndTrace(
            expandToNode`
                beginning ${ traceToNode(source, 'values', 1)(source.values[1]) } end
            `
        );
        // persistSourceRegions(trace);

        expect( text ).toBe('beginning IH end');
        expect( trace ).toMatchObject( <TraceRegion>{
            targetRegion: { offset: 0, length: 16 },
            children: [ {
                sourceRegion: { offset: 3, length: 4, fileURI: documentURI(source) },
                targetRegion: { offset: 10, length: 2 }
            } ]
        });
    });

    test('should trace entire list and its particluar elemens within single node spanning the entire output', async () => {
        const source = await parse2('AH "IH" OH 0815') as AstNode & { values: Array<string | number> };
        const { text, trace } = toStringAndTrace(
            expandTracedToNode(source)`
                beginning ${ joinTracedToNode(source, 'values')(source.values, undefined, { separator: ' ' }) } end
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('beginning AH IH OH 815 end');
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 15, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 26 },
            children: [ {
                sourceRegion: { offset: 0, length: 15, fileURI: undefined },
                targetRegion: { offset: 10, length: 12},
                children: [ {
                    sourceRegion: { offset: 0, length: 2, fileURI: undefined },
                    targetRegion: { offset: 10, length: 2 },
                }, {
                    sourceRegion: { offset: 3, length: 4, fileURI: undefined },
                    targetRegion: { offset: 13, length: 2 },
                }, {
                    sourceRegion: { offset: 8, length: 2, fileURI: undefined },
                    targetRegion: { offset: 16, length: 2 },
                }, {
                    sourceRegion: { offset: 11, length: 4, fileURI: undefined },
                    targetRegion: { offset: 19, length: 3 },
                } ]
            } ]
        });
    });

    test('should trace entire list and its particluar elemens only', async () => {
        const source = await parse2('AH "IH" OH 0815') as AstNode & { values: Array<string | number> };
        const { text, trace } = toStringAndTrace(
            expandToNode`
                beginning ${ joinTracedToNode(source, 'values')(source.values, undefined, { separator: ' ' }) } end
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('beginning AH IH OH 815 end');
        expect( trace ).toMatchObject( <TraceRegion>{
            targetRegion: { offset: 0, length: 26 },
            children: [ {
                sourceRegion: { offset: 0, length: 15, fileURI: documentURI(source) },
                targetRegion: { offset: 10, length: 12 },
                children: [ {
                    sourceRegion: { offset: 0, length: 2, fileURI: undefined },
                    targetRegion: { offset: 10, length: 2 },
                }, {
                    sourceRegion: { offset: 3, length: 4, fileURI: undefined },
                    targetRegion: { offset: 13, length: 2 },
                }, {
                    sourceRegion: { offset: 8, length: 2, fileURI: undefined },
                    targetRegion: { offset: 16, length: 2 },
                }, {
                    sourceRegion: { offset: 11, length: 4, fileURI: undefined },
                    targetRegion: { offset: 19, length: 3 },
                } ]
            } ]
        });
    });

    test('should trace conditionally appended elements', async () => {
        const source = await parse2('AH "IH" OH 0815') as AstNode & { name?: string, values: Array<string | number> };
        const { text, trace } = toStringAndTrace(
            expandToNode`
                Preamble; 
            `.appendTracedIf(!!source.name, source, 'name')(() => source?.name ?? ' WRONG ') /* expected to be _not_ appended! */
            // eslint-disable-next-line @typescript-eslint/indent
            .appendTracedTemplateIf(source.values.length !== 0, source, 'values')`
                beginning ${ joinTracedToNode(source, 'values')(source.values, undefined, { separator: ' ', filter: (_, i) => i % 2 === 1}) } end
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('Preamble; beginning IH 815 end');
        expect( trace ).toMatchObject( <TraceRegion>{
            targetRegion: { offset: 0, length: 30 },
            children: [ {
                sourceRegion: { offset:  0, length: 15, fileURI: documentURI(source) },
                targetRegion: { offset: 10, length: 20 },
                children: [ {
                    sourceRegion: { offset:  0, length: 15, fileURI: undefined },
                    targetRegion: { offset: 20, length: 6 },
                    children: [ {
                        sourceRegion: { offset:  3, length: 4 }, // "IH"
                        targetRegion: { offset: 20, length: 2 }, // IH
                    }, {
                        sourceRegion: { offset: 11, length: 4 }, // 0815
                        targetRegion: { offset: 23, length: 3 }, // 815
                    } ]
                } ]
            } ]
        });
    });
});
