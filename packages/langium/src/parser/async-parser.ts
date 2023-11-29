/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken } from 'vscode-languageserver';
import type { LangiumParser, ParseResult } from './langium-parser.js';
import type { LangiumServices } from '../services.js';
import type { AstNode } from '../syntax-tree.js';

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

    constructor(services: LangiumServices) {
        this.syncParser = services.parser.LangiumParser;
    }

    parse<T extends AstNode>(text: string): Promise<ParseResult<T>> {
        return Promise.resolve(this.syncParser.parse<T>(text));
    }
}
