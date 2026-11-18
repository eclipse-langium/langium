/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

// Everything is imported from the sources, so that the walk, the linker and the test share the state of
// `promise-utils` (`setInterruptionPeriod`) and the `OperationCancelled` symbol.
import type { AstNode, LangiumCoreServices, LangiumDocument, Reference, ReferenceDescription, ReferenceInfo } from '../../src/index.js';
import { AstUtils, Cancellation, DefaultLinker, DefaultReferenceDescriptionProvider, interruptAndCheck, isOperationCancelled, setInterruptionPeriod, URI } from '../../src/index.js';
import { createServicesForGrammar } from '../../src/grammar/index.js';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

const { walkReferences } = AstUtils;

// `walkReferences` replaces this loop in `DefaultLinker.link` and `DefaultReferenceDescriptionProvider.createDescriptions`.
async function streamLoop(root: AstNode, action: (refInfo: ReferenceInfo) => void, cancelToken = Cancellation.CancellationToken.None): Promise<void> {
    for (const node of AstUtils.streamAst(root)) {
        await interruptAndCheck(cancelToken);
        AstUtils.streamReferences(node).forEach(action);
    }
}

// single references, arrays of references, a multi-reference and nested items
const grammar = `
    grammar WalkReferencesTest
    entry Model: items+=Item*;
    Item: 'item' name=ID ('->' target=[Item:ID])? ('uses' uses+=[Item:ID] (',' uses+=[Item:ID])*)?
        ('any' any=[+Item:ID])? ('{' children+=Item* '}')?;
    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

const TREE = `
    item a -> b uses c, d any c {
        item b uses a {
            item c -> a any b
        }
        item d -> missing uses b, missing, c
    }
    item e {
        item f { item g -> e }
    }
    item h uses a any missing
`;

const TREE_REFERENCES = [
    'a.target=b', 'a.uses[0]=c', 'a.uses[1]=d', 'a.any=c',
    'b.uses[0]=a',
    'c.target=a', 'c.any=b',
    'd.target=missing', 'd.uses[0]=b', 'd.uses[1]=missing', 'd.uses[2]=c',
    'g.target=e',
    'h.uses[0]=a', 'h.any=missing'
];

function describeInfo(info: ReferenceInfo): string {
    const container = (info.container as { name?: string }).name ?? info.container.$type;
    return `${container}.${info.property}${info.index === undefined ? '' : `[${info.index}]`}=${info.reference.$refText}`;
}

let services: LangiumCoreServices;
let documentCounter = 0;

beforeAll(async () => {
    services = await createServicesForGrammar({ grammar });
});

function parse(text: string): LangiumDocument {
    return services.shared.workspace.LangiumDocumentFactory.fromString(text, URI.parse(`memory:/walk${documentCounter++}.txt`));
}

async function collect(walk: typeof walkReferences, root: AstNode): Promise<ReferenceInfo[]> {
    const visited: ReferenceInfo[] = [];
    await walk(root, info => visited.push(info));
    return visited;
}

/** Busy-waits, so that nothing else can run meanwhile. */
function blockFor(ms: number): void {
    const until = performance.now() + ms;
    while (performance.now() < until) {
        // busy wait
    }
}

describe('walkReferences', () => {

    test('is part of AstUtils', () => {
        expect(AstUtils.walkReferences).toBeTypeOf('function');
        expect(AstUtils.pushChildrenInDocumentOrder).toBeTypeOf('function');
    });

    afterEach(() => {
        setInterruptionPeriod(10);
    });

    test('visits the same references, containers, properties and indices in the same order as streamAst and streamReferences', async () => {
        const root = parse(TREE).parseResult.value;
        const expected = await collect(streamLoop, root);
        expect(expected.map(describeInfo)).toEqual(TREE_REFERENCES);
        const visited = await collect(walkReferences, root);
        expect(visited).toEqual(expected);
        // the very same reference objects and containers
        visited.forEach((info, i) => {
            expect(info.reference).toBe(expected[i].reference);
            expect(info.container).toBe(expected[i].container);
        });
        // and for every subtree
        for (const node of AstUtils.streamAllContents(root)) {
            expect((await collect(walkReferences, node)).map(describeInfo)).toEqual((await collect(streamLoop, node)).map(describeInfo));
        }
    });

    test('ignores inherited and $-prefixed properties, like streamAst and streamReferences', async () => {
        const reference = (refText: string) => ({ $refText: refText, ref: undefined }) as unknown as Reference;
        const child = { $type: 'Item', name: 'child', target: reference('own') };
        const inheritedChild = { $type: 'Item', name: 'inheritedChild', target: reference('fromInheritedChild') };
        const prototype = { inherited: reference('inherited'), inheritedChildren: [inheritedChild] };
        const root = Object.assign(Object.create(prototype) as AstNode, {
            $type: 'Model',
            $hidden: reference('hidden'),
            $hiddenChild: { $type: 'Item', name: 'hiddenChild', target: reference('fromHiddenChild') },
            children: [child],
            last: reference('last')
        });
        const expected = (await collect(streamLoop, root)).map(describeInfo);
        expect(expected).toEqual(['Model.last=last', 'child.target=own']);
        expect((await collect(walkReferences, root)).map(describeInfo)).toEqual(expected);
    });

    test.each([
        ['CancellationToken.None', () => Cancellation.CancellationToken.None],
        ['a token while no interruption is due', () => {
            setInterruptionPeriod(Number.POSITIVE_INFINITY);
            return new Cancellation.CancellationTokenSource().token;
        }]
    ])('visits all references without awaiting, with %s', async (_, createToken) => {
        const visited: string[] = [];
        const walk = walkReferences(parse(TREE).parseResult.value, info => visited.push(describeInfo(info)), createToken());
        // every reference was visited before the walk awaited anything
        expect(visited).toEqual(TREE_REFERENCES);
        await walk;
    });

    test('rejects with OperationCancelled before the first reference if the token is cancelled', async () => {
        const source = new Cancellation.CancellationTokenSource();
        source.cancel();
        const visited: string[] = [];
        const rejection = await walkReferences(parse(TREE).parseResult.value, info => visited.push(describeInfo(info)), source.token)
            .then(() => undefined, (err: unknown) => err);
        expect(isOperationCancelled(rejection)).toBe(true);
        expect(visited).toEqual([]);
    });

    test('stops at the next node once the token is cancelled', async () => {
        const source = new Cancellation.CancellationTokenSource();
        const visited: string[] = [];
        const rejection = await walkReferences(parse(TREE).parseResult.value, info => {
            visited.push(describeInfo(info));
            source.cancel();
        }, source.token).then(() => undefined, (err: unknown) => err);
        expect(isOperationCancelled(rejection)).toBe(true);
        // the remaining references of the node are still visited, as by `streamReferences(node).forEach`
        expect(visited).toEqual(['a.target=b', 'a.uses[0]=c', 'a.uses[1]=d', 'a.any=c']);
    });

    test('lets the event loop run during a long walk', async () => {
        // 20 references at 2 ms each take about 40 ms, much longer than the interruption period of 10 ms
        const count = 20;
        const text = Array.from({ length: count }, (_, i) => `item n${i} -> n0`).join(' ');
        let turnTaken = false;
        let turnTakenBeforeLastReference: boolean | undefined;
        let visits = 0;
        await walkReferences(parse(text).parseResult.value, () => {
            if (visits === 0) {
                // queued during the walk, so it can only run if the walk yields
                setImmediate(() => turnTaken = true);
            }
            blockFor(2);
            if (++visits === count) {
                turnTakenBeforeLastReference = turnTaken;
            }
        }, new Cancellation.CancellationTokenSource().token);
        expect(turnTakenBeforeLastReference).toBe(true);
    });
});

describe('DefaultLinker and DefaultReferenceDescriptionProvider', () => {

    class RecordingLinker extends DefaultLinker {
        readonly linked: string[] = [];
        protected override doLink(refInfo: ReferenceInfo, document: LangiumDocument): void {
            this.linked.push(describeInfo(refInfo));
            super.doLink(refInfo, document);
        }
    }

    class TestDescriptionProvider extends DefaultReferenceDescriptionProvider {
        /** The descriptions as the provider created them with the `streamAst` loop. */
        async createDescriptionsWithStreams(document: LangiumDocument): Promise<ReferenceDescription[]> {
            const descriptions: ReferenceDescription[] = [];
            await streamLoop(document.parseResult.value, refInfo => {
                if (!refInfo.reference.error) {
                    descriptions.push(...this.createInfoDescriptions(refInfo));
                }
            });
            return descriptions;
        }
    }

    async function build(text: string): Promise<LangiumDocument> {
        const document = parse(text);
        services.shared.workspace.LangiumDocuments.addDocument(document);
        await services.shared.workspace.DocumentBuilder.build([document]);
        return document;
    }

    test('the linker links every reference once, in the order of streamAst and streamReferences', async () => {
        const document = await build(TREE);
        const linker = new RecordingLinker(services);
        linker.unlink(document);
        await linker.link(document);
        expect(linker.linked).toEqual(TREE_REFERENCES);
        const targets = (await collect(streamLoop, document.parseResult.value)).map(({ reference }) =>
            `${reference.$refText} -> ${'items' in reference ? reference.items.length : (reference.ref as { name?: string } | undefined)?.name ?? 'error'}`
        );
        expect(targets).toEqual([
            // `c` is nested in `b`, so it is not visible from `a` and `d`
            'b -> b', 'c -> error', 'd -> d', 'c -> 0',
            'a -> a',
            'a -> a', 'b -> 1',
            'missing -> error', 'b -> b', 'missing -> error', 'c -> error',
            'e -> e',
            'a -> a', 'missing -> 0'
        ]);
    });

    test('the reference index holds the same descriptions in the same order as with streamAst and streamReferences', async () => {
        const document = await build(TREE);
        const provider = new TestDescriptionProvider(services);
        const expected = await provider.createDescriptionsWithStreams(document);
        // the seven resolved single references and the one item of the multi-reference `c.any`
        expect(expected).toHaveLength(8);
        expect(await provider.createDescriptions(document)).toEqual(expected);
    });

    test('the linker and the reference index stop on cancellation', async () => {
        const document = await build(TREE);
        const source = new Cancellation.CancellationTokenSource();
        source.cancel();
        const linker = new RecordingLinker(services);
        linker.unlink(document);
        const linkRejection = await linker.link(document, source.token).then(() => undefined, (err: unknown) => err);
        expect(isOperationCancelled(linkRejection)).toBe(true);
        expect(linker.linked).toEqual([]);
        const indexRejection = await new DefaultReferenceDescriptionProvider(services).createDescriptions(document, source.token)
            .then(() => undefined, (err: unknown) => err);
        expect(isOperationCancelled(indexRejection)).toBe(true);
    });
});
