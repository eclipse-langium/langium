/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TreeStreamImpl, GrammarUtils, type AstNode, type AstNodeWithTextRegion } from 'langium';
import { expandToNode, expandToString, expandTracedToNode, joinTracedToNode, joinTracedToNodeIf, toStringAndTrace, traceToNode, type SourceRegion, type TraceRegion } from 'langium/generate';
import { parseHelper } from 'langium/test';
import { createServicesForGrammar } from 'langium/grammar';
import { beforeAll, describe, expect, test } from 'vitest';

// don't bather because of unexpected indentations, e.g. within template substitutions
/* eslint-disable @typescript-eslint/indent */

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
            end:    tr.sourceRegion.end,
            length: tr.sourceRegion.length,
            fileURI: tr.sourceRegion?.fileURI
        }
    );
    return trace;
}

describe('tracing based on provided text regions', () => {
    function documentURI(root: AstNodeWithTextRegion) {
        return root.$document?.uri?.toString();
    }

    test('should not fail on undefined trace region', async () => {
        const { trace } = toStringAndTrace(
            expandTracedToNode(undefined)`
                beginning ... end
            `
        );
        persistSourceRegions(trace);

        expect( trace ).toMatchObject( <TraceRegion>{
            targetRegion: {
                offset: 0, length: 17,
                range: {
                    start: { line: 0, character: 0},
                    end:   { line: 0, character: 17}
                }
            },
        });
    });

    test('should trace single region based on a given text region', async () => {
        const { trace } = toStringAndTrace(
            expandTracedToNode(<SourceRegion>{ offset: 0, length: 999 })`
                beginning ... end
            `
        );
        persistSourceRegions(trace);

        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 999, fileURI: undefined },
            targetRegion: { offset: 0, length: 17 },
        });
    });

    test('should trace single region based on multiple given text regions', async () => {
        const { trace } = toStringAndTrace(
            expandTracedToNode([
                <SourceRegion>{ offset: 3, end: 8 },
                <SourceRegion>{ offset: 10, end: 999 }
            ])`
                beginning ... end
            `
        );
        persistSourceRegions(trace);

        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 3, length: 996, fileURI: undefined },
            targetRegion: { offset: 0, length: 17 },
        });
    });

    test('should trace single region based on cstNode', async () => {
        const source = await parse('AH "IH" OH');
        const { trace } = toStringAndTrace(
            expandTracedToNode(source.$cstNode)`
                beginning ... end
            `
        );
        persistSourceRegions(trace);

        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 17 },
        });
    });

    test('should trace nested regions with different fileURIs based on cstNode', async () => {
        const source = await parse('AH "IH" OH');
        const { trace } = toStringAndTrace(
            traceToNode(<SourceRegion>{ offset: 3, end: 7, fileURI: 'file://foo'})(
                expandTracedToNode(source.$cstNode)`
                    beginning ... end
                `
            )
        );
        persistSourceRegions(trace);

        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 3, length: 4, fileURI: 'file://foo' },
            targetRegion: { offset: 0, length: 17 },
            children: [ {
                sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
                targetRegion: { offset: 0, length: 17 }
            } ]
        });
    });

    test('should trace region based on union of cstNodes', async () => {
        const source = await parse('AH "IH" OH children { name=bar }') as AstNode & { children: Array<AstNode & { name: string }> };
        const { text, trace } = toStringAndTrace(
            expandTracedToNode(source.$cstNode)`
                beginning ${
                    joinTracedToNodeIf(source.children.length > 0, () => [
                        GrammarUtils.findNodeForKeyword(source.$cstNode, '{')!,
                        GrammarUtils.findNodeForKeyword(source.$cstNode, '}')!
                    ] )(source.children, c => c.name)
                } end
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('beginning bar end');
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 32, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 17 },
            children: [ {
                sourceRegion: { offset: 20, length: 12, fileURI: undefined },
                targetRegion: { offset: 10, length: 3 },
            } ]
        });
    });

    test('should trace region based on union of list of property entries\' cstNodes', async () => {
        const source = await parse('AH "IH" OH') as AstNode & { values: string[] };
        const { text, trace } = toStringAndTrace(
            expandTracedToNode(source.$cstNode)`
                beginning ${
                    joinTracedToNodeIf(source.values.length > 0, () => GrammarUtils.findNodesForProperty(source.$cstNode, 'values'))(source.values)
                } end
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('beginning AHIHOH end');
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 20 },
            children: [ {
                sourceRegion: { offset: 0, length: 10, fileURI: undefined },
                targetRegion: { offset: 10, length: 6 },
            } ]
        });
    });

    test('should trace region based on union of cstNodes with broken condition', async () => {
        const source = await parse('AH "IH" OH') as AstNode & { children?: Array<AstNode & { name: string }> };
        const { text, trace } = toStringAndTrace(
            expandTracedToNode(source.$cstNode)`
                beginning ${
                    joinTracedToNodeIf(!!source.children /* incomplete condition, array is always initialized, but possibly empty */, () => [
                        GrammarUtils.findNodeForKeyword(source.$cstNode, '{')!,
                        GrammarUtils.findNodeForKeyword(source.$cstNode, '}')!
                    ] )(source.children!, c => c.name)
                } end
            `
        );
        persistSourceRegions(trace);

        expect( text ).toBe('beginning  end');
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, length: 10, fileURI: documentURI(source) },
            targetRegion: { offset: 0, length: 14 },
        });
    });
});

describe('tracing of indented text based on provided text regions', () => {

    test('should indent text regions of indented multi-line text', () => {
        const { text, trace } = toStringAndTrace(
            expandTracedToNode({ offset: 0, end: 100 })`
                ${ traceToNode({ offset: 1, end: 3 })('A')} {
                    ${ /* indented multi-line substition: */ expandTracedToNode({ offset: 10, end: 50 })`
                        ${ traceToNode({ offset: 11, end: 13 })('B')} {
                            ${ traceToNode({ offset: 21, end: 23 })('C')}
                        }
                        ${ traceToNode({ offset: 31, end: 33 })('D')} {
                            ${ traceToNode({ offset: 41, end: 43 })('E')}
                        }
                    `}
                }
                ${ traceToNode({ offset: 51, end: 53 })('F')}
            `/*
                the foregoing template has just 3 single lines, with the second of 3 substitions being an indented multi-line substition;
                that substition's indentation need to be repeated to all its lines and also applied to the various trace regions within those lines!
            */
        );

        expect( text ).toBe( expandToString`
            A {
                B {
                    C
                }
                D {
                    E
                }
            }
            F
        `);
        expect( trace ).toMatchObject( <TraceRegion>{
            sourceRegion: { offset: 0, end: 100 },
            children: [
                {
                    sourceRegion: { offset: 1, end: 3 },
                    targetRegion: {
                        range: {
                            start: { line: 0, character: 0},  // <= expected (zero) indentation
                            end:   { line: 0, character: 1},  // <= expected (zero) indentation
                        }
                    }
                }, {
                    sourceRegion: { offset: 10, end: 50 },
                    children: [
                        {
                            sourceRegion: { offset: 11, end: 13 },
                            targetRegion: {
                                range: {
                                    start: { line: 1, character: 4},  // <= expected indentation
                                    end:   { line: 1, character: 5},  // <= expected indentation
                                }
                            }
                        }, {
                            sourceRegion: { offset: 21, end: 23 },
                            targetRegion: {
                                range: {
                                    start: { line: 2, character: 8},  // <= expected indentation
                                    end:   { line: 2, character: 9},  // <= expected indentation
                                }
                            }
                        }, {
                            sourceRegion: { offset: 31, end: 33 },
                            targetRegion: {
                                range: {
                                    start: { line: 4, character: 4},  // <= expected indentation
                                    end:   { line: 4, character: 5},  // <= expected indentation
                                }
                            }
                        }, {
                            sourceRegion: { offset: 41, end: 43 },
                            targetRegion: {
                                range: {
                                    start: { line: 5, character: 8},  // <= expected indentation
                                    end:   { line: 5, character: 9},  // <= expected indentation
                                }
                            }
                        }
                    ]
                }, {
                    sourceRegion: { offset: 51, end: 53 },
                    targetRegion: {
                        range: {
                            start: { line: 8, character: 0},  // <= expected (zero) indentation
                            end:   { line: 8, character: 1},  // <= expected (zero) indentation
                        }
                    }
                }
            ]
        });
    });
});

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
                beginning ${ joinTracedToNode(source, 'values')(source.values, { separator: ' ' }) } end
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
