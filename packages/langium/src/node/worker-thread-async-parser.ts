/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ParserWorker } from '../index.js';
import { AbstractThreadedAsyncParser } from '../parser/async-parser.js';
import { Worker } from 'node:worker_threads';

export abstract class AbstractWorkerThreadAsyncParser extends AbstractThreadedAsyncParser {

    protected override createWorker(): ParserWorker {
        const worker = new Worker(this.getWorkerPath());
        const parserWorker = new WorkerThreadParserWorker(worker);
        return parserWorker;
    }

}

export class WorkerThreadParserWorker extends ParserWorker {

    constructor(worker: Worker) {
        super(
            (message) => worker.postMessage(message),
            cb => worker.on('message', cb),
            cb => worker.on('error', cb),
            () => worker.terminate()
        );
    }

}
