/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, LangiumCoreServices, MaybePromise, ValidateSingleNodeOptions, ValidationAcceptor, ValidationOptions } from 'langium';
import { Cancellation, DefaultDocumentValidator, isOperationCancelled, OperationCancelled, setInterruptionPeriod, URI, ValidationRegistry } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// Tests for the AST walk of `DefaultDocumentValidator.validateAstNodes` and the check wrapper of `ValidationRegistry`:
// the order in which nodes are validated, how errors of synchronous and asynchronous checks are reported,
// cancellation, and when the walk awaits something.

const grammar = `
    grammar WalkTest
    entry Model: items+=Item*;
    Item: 'item' name=ID ('{' children+=Item* '}')? ('then' next=Item)?;
    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

interface Item extends AstNode {
    name: string
}

type WalkTestAstType = {
    Item: Item
}

function isItem(node: AstNode): node is Item {
    return node.$type === 'Item';
}

/** An item with this name is validated, but its children are not. */
const PRUNED = 'pruned';

/** Items in document order: a, b, c, pruned, (hidden), e, f, g, h. `then` makes a node with two child properties. */
const TREE = `item a { item b { item c } item ${PRUNED} { item hidden } item e } then item f { item g } item h`;
const TREE_ORDER = ['a', 'b', 'c', PRUNED, 'e', 'f', 'g', 'h'];

class TestValidator extends DefaultDocumentValidator {
    protected override validateSingleNodeOptions(node: AstNode, options: ValidationOptions): ValidateSingleNodeOptions {
        const nodeOptions = super.validateSingleNodeOptions(node, options);
        return isItem(node) && node.name === PRUNED ? { ...nodeOptions, validateChildren: false } : nodeOptions;
    }

    /** Runs only the AST walk, without awaiting it. */
    walk(root: AstNode, accept: ValidationAcceptor, cancelToken?: Cancellation.CancellationToken): Promise<void> {
        return this.validateAstNodes(root, {}, accept, cancelToken);
    }
}

type ItemCheck = (item: Item, accept: ValidationAcceptor) => MaybePromise<void>;

let services: LangiumCoreServices;
let documentCounter = 0;

beforeAll(async () => {
    services = await createServicesForGrammar({ grammar });
});

function createValidator(check: ItemCheck, registry = new ValidationRegistry(services)): TestValidator {
    registry.register<WalkTestAstType>({ Item: check });
    return new TestValidator({ ...services, validation: { ...services.validation, ValidationRegistry: registry } });
}

function parse(text: string): AstNode {
    return services.shared.workspace.LangiumDocumentFactory.fromString(text, URI.parse(`memory:/walk${documentCounter++}.txt`)).parseResult.value;
}

async function validate(validator: TestValidator, text: string, cancelToken?: Cancellation.CancellationToken): Promise<{ messages: string[], rejection?: unknown }> {
    const messages: string[] = [];
    try {
        await validator.walk(parse(text), (_severity, message) => messages.push(message), cancelToken);
        return { messages };
    } catch (rejection) {
        return { messages, rejection };
    }
}

/** Busy-waits, so that nothing else can run meanwhile. */
function blockFor(ms: number): void {
    const until = performance.now() + ms;
    while (performance.now() < until) {
        // busy wait
    }
}

describe('DefaultDocumentValidator AST walk', () => {

    beforeEach(() => {
        // `handleException` logs every error it reports as a diagnostic
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        setInterruptionPeriod(10);
    });

    test('visits the nodes in document order and skips the children of pruned nodes', async () => {
        const visited: string[] = [];
        const validator = createValidator(item => {
            visited.push(item.name);
        });
        await validate(validator, TREE);
        expect(visited).toEqual(TREE_ORDER);
    });

    test('reports errors of synchronous and asynchronous checks and continues with the next node', async () => {
        const visited: string[] = [];
        const validator = createValidator((item, accept) => {
            visited.push(item.name);
            switch (item.name) {
                case 'a':
                    throw new Error('sync failure');
                case 'b':
                    return Promise.resolve().then(() => accept('warning', 'async warning', { node: item }));
                case 'c':
                    return Promise.reject(new Error('async failure'));
                case 'e':
                    // eslint-disable-next-line no-throw-literal
                    throw 'plain failure';
                case 'f':
                    return (async () => {
                        await Promise.resolve();
                        throw new Error('async throw');
                    })();
                default:
                    accept('info', `checked ${item.name}`, { node: item });
                    return undefined;
            }
        });
        const { messages, rejection } = await validate(validator, TREE);
        expect(rejection).toBeUndefined();
        expect(visited).toEqual(TREE_ORDER);
        expect(messages).toEqual([
            'An error occurred during validation: sync failure',
            'async warning',
            'An error occurred during validation: async failure',
            'checked pruned',
            'An error occurred during validation: plain failure',
            'An error occurred during validation: async throw',
            'checked g',
            'checked h'
        ]);
        expect(console.error).toHaveBeenCalledWith('An error occurred during validation:', 'plain failure');
    });

    test('awaits an asynchronous check before the next check and the next node', async () => {
        const events: string[] = [];
        const registry = new ValidationRegistry(services);
        registry.register<WalkTestAstType>({
            Item: async (item: Item) => {
                events.push(`start ${item.name}`);
                await new Promise(resolve => setTimeout(resolve, 1));
                events.push(`end ${item.name}`);
            }
        });
        const validator = createValidator(item => {
            events.push(`sync ${item.name}`);
        }, registry);
        await validate(validator, 'item a item b');
        expect(events).toEqual(['start a', 'end a', 'sync a', 'start b', 'end b', 'sync b']);
    });

    test.each([
        ['synchronously', (): MaybePromise<void> => {
            throw OperationCancelled;
        }],
        ['asynchronously', async (): Promise<void> => {
            await Promise.resolve();
            throw OperationCancelled;
        }]
    ])('rejects with OperationCancelled thrown %s by a check', async (_, cancel) => {
        const visited: string[] = [];
        const validator = createValidator(item => {
            visited.push(item.name);
            return item.name === 'b' ? cancel() : undefined;
        });
        const { messages, rejection } = await validate(validator, TREE);
        expect(isOperationCancelled(rejection)).toBe(true);
        expect(visited).toEqual(['a', 'b']);
        expect(messages).toEqual([]);
    });

    test('stops at the next node once the token is cancelled', async () => {
        const source = new Cancellation.CancellationTokenSource();
        const visited: string[] = [];
        const validator = createValidator(item => {
            visited.push(item.name);
            if (item.name === 'b') {
                source.cancel();
            }
        });
        const { rejection } = await validate(validator, TREE, source.token);
        expect(isOperationCancelled(rejection)).toBe(true);
        expect(visited).toEqual(['a', 'b']);
    });

    test('lets the event loop run during a long walk', async () => {
        // 20 items at 2 ms each take about 40 ms, much longer than the interruption period of 10 ms
        const count = 20;
        let turnTaken = false;
        let turnTakenBeforeLastItem: boolean | undefined;
        const validator = createValidator(item => {
            if (item.name === 'n0') {
                // queued during the walk, so it can only run if the walk yields
                setImmediate(() => turnTaken = true);
            }
            blockFor(2);
            if (item.name === `n${count - 1}`) {
                turnTakenBeforeLastItem = turnTaken;
            }
        });
        const text = Array.from({ length: count }, (_, i) => `item n${i}`).join(' ');
        await validate(validator, text, new Cancellation.CancellationTokenSource().token);
        expect(turnTakenBeforeLastItem).toBe(true);
    });

    test.each([
        ['CancellationToken.None', () => Cancellation.CancellationToken.None],
        ['a token while no interruption is due', () => {
            setInterruptionPeriod(Number.POSITIVE_INFINITY);
            return new Cancellation.CancellationTokenSource().token;
        }]
    ])('validates all nodes without awaiting when the checks are synchronous, with %s', async (_, createToken) => {
        const visited: string[] = [];
        // one check that returns nothing and one that returns a value that is not a promise
        const registry = new ValidationRegistry(services);
        registry.register<WalkTestAstType>({ Item: (item: Item) => (visited.push(item.name), false) as unknown as void });
        const validator = createValidator(item => {
            visited.push(item.name);
        }, registry);
        const walk = validator.walk(parse(TREE), () => undefined, createToken());
        // everything has been validated before the walk awaited anything
        expect(visited).toEqual(TREE_ORDER.flatMap(name => [name, name]));
        await walk;
    });
});

describe('ValidationRegistry check wrapper', () => {

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const item = { $type: 'Item', name: 'x' } as Item;

    test('returns a promise only if the check returned one', async () => {
        const registry = new ValidationRegistry(services);
        registry.register<WalkTestAstType>({ Item: [() => undefined, () => Promise.resolve(), () => false as unknown as void] });
        const [sync, async, other] = registry.getCheckArray('Item');
        const accept = vi.fn();
        expect(sync(item, accept, Cancellation.CancellationToken.None)).toBeUndefined();
        const pending = async(item, accept, Cancellation.CancellationToken.None);
        expect(pending).toBeInstanceOf(Promise);
        await pending;
        expect(other(item, accept, Cancellation.CancellationToken.None)).toBeUndefined();
        expect(accept).not.toHaveBeenCalled();
    });

    test('reports a synchronous error before it returns', async () => {
        const registry = new ValidationRegistry(services);
        registry.register<WalkTestAstType>({ Item: () => { throw new Error('sync failure'); } });
        const [check] = registry.getCheckArray('Item');
        const accept = vi.fn();
        const pending = check(item, accept, Cancellation.CancellationToken.None);
        expect(accept).toHaveBeenCalledWith('error', 'An error occurred during validation: sync failure', { node: item });
        await pending;
        expect(accept).toHaveBeenCalledTimes(1);
    });

    test('passes the errors of synchronous and asynchronous checks to handleException', async () => {
        const handled: unknown[] = [];
        class RecordingRegistry extends ValidationRegistry {
            protected override async handleException(functionality: () => MaybePromise<void>): Promise<void> {
                try {
                    await functionality();
                } catch (err) {
                    handled.push(err);
                }
            }
        }
        const syncError = new Error('sync');
        const asyncError = new Error('async');
        const registry = new RecordingRegistry(services);
        registry.register<WalkTestAstType>({ Item: [() => { throw syncError; }, () => Promise.reject(asyncError), () => undefined] });
        const accept = vi.fn();
        for (const check of registry.getCheckArray('Item')) {
            await check(item, accept, Cancellation.CancellationToken.None);
        }
        expect(handled).toEqual([syncError, asyncError]);
        expect(accept).not.toHaveBeenCalled();
    });

    test.each([
        ['synchronously', () => {
            throw OperationCancelled;
        }],
        ['asynchronously', () => Promise.reject(OperationCancelled)]
    ])('rethrows OperationCancelled thrown %s', async (_, cancel) => {
        const registry = new ValidationRegistry(services);
        registry.register<WalkTestAstType>({ Item: cancel });
        const [check] = registry.getCheckArray('Item');
        const accept = vi.fn();
        await expect(Promise.resolve().then(() => check(item, accept, Cancellation.CancellationToken.None))).rejects.toBe(OperationCancelled);
        expect(accept).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });
});
