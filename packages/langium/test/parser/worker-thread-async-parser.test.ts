/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { AbstractWorkerThreadAsyncParser } from 'langium/node';
import { createLangiumGrammarServices } from 'langium/grammar';
import type { Grammar, ParseResult } from 'langium';
import { EmptyFileSystem, GrammarUtils, isOperationCancelled } from 'langium';
import { CancellationToken, CancellationTokenSource } from 'vscode-languageserver';
import { fail } from 'node:assert';

class TestAsyncParser extends AbstractWorkerThreadAsyncParser {
    protected getWorkerPath(): string {
        return __dirname + '/worker-thread.js';
    }
}

describe('WorkerThreadAsyncParser', () => {

    test('performs async parsing in parallel', async () => {
        const services = createLangiumGrammarServices(EmptyFileSystem, undefined, {
            parser: {
                AsyncParser: (services) => new TestAsyncParser(services)
            }
        }).grammar;
        const file = createLargeFile(10);
        const asyncParser = services.parser.AsyncParser;
        const promises: Array<Promise<ParseResult<Grammar>>> = [];
        for (let i = 0; i < 16; i++) {
            promises.push(asyncParser.parse<Grammar>(file, CancellationToken.None));
        }
        const result = await Promise.all(promises);
        for (const parseResult of result) {
            expect(parseResult.value.name).toBe('Test');
            expect(GrammarUtils.findNodeForProperty(parseResult.value.$cstNode, 'name')!.offset).toBe(8);
        }
    });

    test('async parsing can be cancelled', async () => {
        const services = createLangiumGrammarServices(EmptyFileSystem, undefined, {
            parser: {
                AsyncParser: (services) => new TestAsyncParser(services)
            }
        }).grammar;
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

    function createLargeFile(size: number): string {
        let result = 'grammar Test;\n';
        for (let i = 0; i < size; i++) {
            result += 'TestRule' + i + ': name="Hello";\n';
        }
        return result;
    }
});
