/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { WorkerThreadAsyncParser } from 'langium/node';
import { createLangiumGrammarServices } from 'langium/grammar';
import type { AstNode, Grammar, LangiumCoreServices, ParseResult, AstReassembler, AstReassemblerContext } from 'langium';
import type { LangiumServices } from 'langium/lsp';
import { EmptyFileSystem, GrammarUtils, CstUtils, GrammarAST, isOperationCancelled, Deferred, ParserWorker, BiMap } from 'langium';
import { CancellationToken, CancellationTokenSource } from 'vscode-languageserver';
import { fail } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

class TestAsyncParser extends WorkerThreadAsyncParser {
    protected reassembler: AstReassembler;
    constructor(services: LangiumCoreServices) {
        super(services, () => fileURLToPath(new URL('.', import.meta.url)) + '/worker-thread-beamer.js');
        this.reassembler = services.serializer.AstReassembler;
    }
    setThreadCount(threadCount: number): void {
        this.threadCount = threadCount;
    }
    override async parse<T extends AstNode>(text: string, cancelToken: CancellationToken): Promise<ParseResult<T>> {
        const worker = await this.acquireParserWorker(cancelToken);
        const deferred = new Deferred<ParseResult<T>>();
        let timeout: NodeJS.Timeout | undefined;
        // If the cancellation token is requested, we wait for a certain time before terminating the worker.
        // Since the cancellation token lives longer than the parsing process, we need to dispose the event listener.
        // Otherwise, we might accidentally terminate the worker after the parsing process has finished.
        const cancellation = cancelToken.onCancellationRequested(() => {
            timeout = setTimeout(() => {
                this.terminateWorker(worker);
            }, this.terminationDelay);
        });
        worker.parse(text).then(result => {
            deferred.resolve(result as unknown as ParseResult<T>);
        }).catch(err => {
            deferred.reject(err);
        }).finally(() => {
            cancellation.dispose();
            clearTimeout(timeout);
        });
        return deferred.promise;
    }
    protected override createWorker(): ParserWorker {
        const path = typeof this.workerPath === 'function' ? this.workerPath() : this.workerPath;
        const worker = new Worker(path);
        const parserWorker = new BeamingParserWorker(worker, this.reassembler);
        return parserWorker;
    }

}

class BeamingParserWorker extends ParserWorker {
    constructor(worker: Worker, reassembler: AstReassembler) {
        super(
            (message) => worker.postMessage(message),
            cb => {
                const context: AstReassemblerContext = {
                    cstStack: [],
                    elementToId: new BiMap(),
                    idToAstNode: [],
                    idToCstNode: [],
                    lexerErrors: [],
                    nextFreeCstNode: 0,
                    parserErrors: [],
                    rootAstNodeId: -1,
                    rootCstNodeId: -1,

                };
                worker.on('message', (instr) => {
                    if(reassembler.reassemble(context, instr)) {
                        cb(reassembler.buildParseResult<AstNode>(context));
                    }
                });
            },
            cb => worker.on('error', cb),
            () => worker.terminate()
        );
    }

}

describe('WorkerThreadAsyncParser with Beamer', () => {

    test('BEAMER performs async parsing in parallel', async () => {
        const services = getServices();
        const file = createLargeFile(10);
        const asyncParser = services.parser.AsyncParser as TestAsyncParser;
        asyncParser.setThreadCount(4);
        const promises: Array<Promise<ParseResult<Grammar>>> = [];
        for (let i = 0; i < 16; i++) {
            promises.push(asyncParser.parse<Grammar>(file, CancellationToken.None));
        }
        const result = await Promise.all(promises);
        for (const parseResult of result) {
            console.log(GrammarUtils.findNodeForProperty(parseResult.value.$cstNode, 'name')!.offset);
            expect(parseResult.value.name).toBe('Test');
            expect(GrammarUtils.findNodeForProperty(parseResult.value.$cstNode, 'name')!.offset).toBe(8);
        }
    }, 20000);

    test('BEAMER async parsing can be cancelled', async () => {
        const services = getServices();
        // This file should take a few seconds to parse
        const file = createLargeFile(100000);
        const asyncParser = services.parser.AsyncParser;
        const cancellationTokenSource = new CancellationTokenSource();
        setTimeout(() => cancellationTokenSource.cancel(), 50);
        const start = Date.now();
        try {
            await asyncParser.parse<Grammar>(file, cancellationTokenSource.token);
            fail('Parsing should have been cancelled');
        } catch (err) {
            expect(isOperationCancelled(err)).toBe(true);
        }
        const end = Date.now();
        // The whole parsing process should have been successfully cancelled within a second
        expect(end - start).toBeLessThan(1000);
    });

    test('BEAMER async parsing can be cancelled and then restarted', async () => {
        const services = getServices();
        // This file should take a few seconds to parse
        const file = createLargeFile(100000);
        const asyncParser = services.parser.AsyncParser;
        const cancellationTokenSource = new CancellationTokenSource();
        setTimeout(() => cancellationTokenSource.cancel(), 50);
        try {
            await asyncParser.parse<Grammar>(file, cancellationTokenSource.token);
            fail('Parsing should have been cancelled');
        } catch (err) {
            expect(isOperationCancelled(err)).toBe(true);
        }
        // Calling this method should recreate the worker and parse the file correctly
        const result = await asyncParser.parse<Grammar>(createLargeFile(10), CancellationToken.None);
        expect(result.value.name).toBe('Test');
    });

    test('BEAMER async parsing yields correct CST', async () => {
        const services = getServices();
        const file = createLargeFile(10);
        const result = await services.parser.AsyncParser.parse<Grammar>(file, CancellationToken.None);
        const index = file.indexOf('TestRule');
        // Assert that the CST can be found at all from the root node
        // This indicates that the CST is correctly linked to itself
        const node = CstUtils.findLeafNodeAtOffset(result.value.$cstNode!, index)!;
        expect(node).toBeDefined();
        expect(node.text).toBe('TestRule0');
        // Assert that the CST node is correctly linked to its container elements
        expect(node.container?.container).toBeDefined();
        expect(node.container!.container!.text).toBe('TestRule0: name="Hello";');
        // Assert that the CST node has a reference to the root
        expect(node.root).toBeDefined();
        expect(node.root.fullText).toBe(file);
        // Assert that the CST node has a reference to the correct AST node
        const astNode = node?.astNode as GrammarAST.ParserRule;
        expect(astNode).toBeDefined();
        expect(astNode.$type).toBe(GrammarAST.ParserRule);
        expect(astNode.name).toBe('TestRule0');
    });

    test('BEAMER parser errors are correctly transmitted', async () => {
        const services = getServices();
        const file = 'grammar Test Rule: name="Hello" // missing semicolon';
        const result = await services.parser.AsyncParser.parse<Grammar>(file, CancellationToken.None);
        expect(result.parserErrors).toHaveLength(1);
        expect(result.parserErrors[0].name).toBe('MismatchedTokenException');
        expect(result.parserErrors[0]).toHaveProperty('previousToken');
        expect(result.parserErrors[0]).toHaveProperty('message', "Expecting token of type ';' but found ``.");
    });

    test.skip('BEAMER Check metrics of async parser', async () => {
        const services = getServices();
        // This file should take a few seconds to parse
        const file = createLargeFile(100_000);
        const asyncParser = services.parser.AsyncParser;
        const start = Date.now();
        const promise = asyncParser.parse<Grammar>(file, CancellationToken.None);
        await promise;
        const end = Date.now();
        console.log(end-start);
    }, 100_000);

    function createLargeFile(size: number): string {
        let result = 'grammar Test\n';
        for (let i = 0; i < size; i++) {
            result += 'TestRule' + i + ': name="Hello";\n';
        }
        return result;
    }

    function getServices(): LangiumServices {
        const services = createLangiumGrammarServices(EmptyFileSystem, undefined, {
            parser: {
                AsyncParser: (services) => new TestAsyncParser(services)
            }
        }).grammar;
        // We usually only need one thread for testing
        (services.parser.AsyncParser as TestAsyncParser).setThreadCount(1);
        return services;
    }
});
