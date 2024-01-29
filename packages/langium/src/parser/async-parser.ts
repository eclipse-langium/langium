/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken } from '../utils/cancellation.js';
import type { LangiumCoreServices } from '../services.js';
import type { AstNode } from '../syntax-tree.js';
import type { LangiumParser, ParseResult } from './langium-parser.js';

/**
 * Async parser that allows to cancel the current parsing process.
 * The sync parser implementation is blocking the event loop, which can become quite problematic for large files.
 *
 * Note that the default implementation is not actually async. It just wraps the sync parser in a promise.
 * A real implementation would create worker threads or web workers to offload the parsing work.
 */
export interface AsyncParser {
    parse<T extends AstNode>(text: string, cancelToken: CancellationToken): Promise<ParseResult<T>>;
}

/**
 * Default implementation of the async parser. This implementation only wraps the sync parser in a promise.
 *
 * A real implementation would create worker threads or web workers to offload the parsing work.
 */
export class DefaultAsyncParser implements AsyncParser {

    protected readonly syncParser: LangiumParser;

    constructor(services: LangiumCoreServices) {
        this.syncParser = services.parser.LangiumParser;
    }

    parse<T extends AstNode>(text: string): Promise<ParseResult<T>> {
        return Promise.resolve(this.syncParser.parse<T>(text));
    }
}

export abstract class AbstractThreadedAsyncParser implements AsyncParser {

    /**
     * The thread count determines how many threads are used to parse files in parallel.
     * The default value is 8. Decreasing this value increases startup performance, but decreases parallel parsing performance.
     */
    protected threadCount = 8;
    /**
     * The termination delay determines how long the parser waits for a thread to finish after a cancellation request.
     * The default value is 200(ms).
     */
    protected terminationDelay = 200;
    protected workerPool: ParserWorker[] = [];
    protected queue: Array<Deferred<ParserWorker>> = [];

    protected readonly hydrator: Hydrator;

    constructor(services: LangiumServices) {
        this.hydrator = services.serializer.Hydrator;
    }

    protected initializeWorkers(): void {
        while (this.workerPool.length < this.threadCount) {
            const worker = this.createWorker();
            worker.onReady(() => {
                if (this.queue.length > 0) {
                    const deferred = this.queue.shift();
                    if (deferred) {
                        worker.lock();
                        deferred.resolve(worker);
                    }
                }
            });
            this.workerPool.push(worker);
        }
    }

    async parse<T extends AstNode>(text: string, cancelToken: CancellationToken): Promise<ParseResult<T>> {
        const worker = await this.acquireParserWorker(cancelToken);
        const deferred = new Deferred<ParseResult<T>>();
        const disposable = cancelToken.onCancellationRequested(() => {
            const timeout = setTimeout(() => {
                this.killWorker(worker);
                deferred.reject(OperationCancelled);
            }, this.terminationDelay);
            deferred.promise.finally(() => clearTimeout(timeout));
        });
        deferred.promise.finally(() => disposable.dispose());
        worker.parse(text).then(result => {
            result.value = this.hydrator.hydrate(result.value);
            deferred.resolve(result as ParseResult<T>);
        }).catch(err => {
            deferred.reject(err);
        });
        return deferred.promise;
    }

    protected killWorker(worker: ParserWorker): void {
        worker.terminate();
        const index = this.workerPool.indexOf(worker);
        if (index >= 0) {
            this.workerPool.splice(index, 1);
        }
    }

    protected async acquireParserWorker(cancelToken: CancellationToken): Promise<ParserWorker> {
        this.initializeWorkers();
        for (const worker of this.workerPool) {
            if (worker.ready) {
                worker.lock();
                return worker;
            }
        }
        const deferred = new Deferred<ParserWorker>();
        const disposable = cancelToken.onCancellationRequested(() => {
            const index = this.queue.indexOf(deferred);
            if (index >= 0) {
                this.queue.splice(index, 1);
            }
            deferred.reject(OperationCancelled);
        });
        deferred.promise.finally(() => disposable.dispose());
        this.queue.push(deferred);
        return deferred.promise;
    }

    protected abstract getWorkerPath(): string;
    protected abstract createWorker(): ParserWorker;
}

export type WorkerMessagePost = (message: unknown) => void;
export type WorkerMessageCallback = (cb: (message: unknown) => void) => void;

export class ParserWorker {

    protected readonly sendMessage: WorkerMessagePost;
    protected readonly _terminate: () => void;
    protected readonly onReadyEmitter = new Emitter<void>();

    protected deferred = new Deferred<ParseResult>();
    protected _ready: boolean = true;

    get ready(): boolean {
        return this._ready;
    }

    get onReady(): Event<void> {
        return this.onReadyEmitter.event;
    }

    constructor(sendMessage: WorkerMessagePost, onMessage: WorkerMessageCallback, onError: WorkerMessageCallback, terminate: () => void) {
        this.sendMessage = sendMessage;
        this._terminate = terminate;
        onMessage(result => {
            const parseResult = result as ParseResult;
            this.deferred.resolve(parseResult);
            this.unlock();
        });
        onError(error => {
            this.deferred.reject(error);
            this.unlock();
        });
    }

    terminate(): void {
        this.deferred.reject(OperationCancelled);
        this._terminate();
    }

    lock(): void {
        this._ready = false;
    }

    unlock(): void {
        this._ready = true;
        this.onReadyEmitter.fire();
    }

    parse(text: string): Promise<ParseResult> {
        this.deferred = new Deferred();
        this.sendMessage(text);
        return this.deferred.promise;
    }
}
