/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { WorkerThreadAsyncParser } from 'langium/node';
import { createLangiumGrammarServices } from 'langium/grammar';
import type { Grammar, LangiumCoreServices, ParseResult } from 'langium';
import type { LangiumServices } from 'langium/lsp';
import { EmptyFileSystem, GrammarUtils, CstUtils, GrammarAST, isOperationCancelled } from 'langium';
import { CancellationToken, CancellationTokenSource } from 'vscode-languageserver';
import { fail } from 'node:assert';
import { fileURLToPath } from 'node:url';

class TestAsyncParser extends WorkerThreadAsyncParser {
    constructor(services: LangiumCoreServices) {
        super(services, () => fileURLToPath(new URL('.', import.meta.url)) + '/worker-thread.js');
    }
    setThreadCount(threadCount: number): void {
        this.threadCount = threadCount;
    }
}

describe('WorkerThreadAsyncParser', () => {

    test('performs async parsing in parallel', async () => {
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
            expect(parseResult.value.name).toBe('Test');
            expect(GrammarUtils.findNodeForProperty(parseResult.value.$cstNode, 'name')!.offset).toBe(8);
        }
    }, 20000);

    test('async parsing can be cancelled', async () => {
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

    test('async parsing can be cancelled and then restarted', async () => {
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

    test('async parsing yields correct CST', async () => {
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

    test('parser errors are correctly transmitted', async () => {
        const services = getServices();
        const file = 'grammar Test Rule: name="Hello" // missing semicolon';
        const result = await services.parser.AsyncParser.parse<Grammar>(file, CancellationToken.None);
        expect(result.parserErrors).toHaveLength(1);
        expect(result.parserErrors[0].name).toBe('MismatchedTokenException');
        expect(result.parserErrors[0]).toHaveProperty('previousToken');
        expect(result.parserErrors[0]).toHaveProperty('message', "Expecting token of type ';' but found ``.");
    });

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
