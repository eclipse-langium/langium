/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Disposable } from 'vscode-languageserver';
import type { URI } from 'vscode-uri';
import type { LangiumSharedServices } from '../services';

export abstract class DisposableCache implements Disposable {

    protected toDispose: Disposable;
    protected isDisposed = false;

    constructor(disposable: Disposable) {
        this.toDispose = disposable;
    }

    dispose(): void {
        this.throwIfDisposed();
        this.clear();
        this.isDisposed = true;
        this.toDispose.dispose();
    }

    throwIfDisposed(): void {
        if (this.isDisposed) {
            throw new Error('This cache has already been disposed');
        }
    }

    abstract clear(): void;
}

export class SimpleCache<K, V> extends DisposableCache {
    protected cache = new Map<K, V>();

    has(key: K): boolean {
        this.throwIfDisposed();
        return this.cache.has(key);
    }

    set(key: K, value: V): void {
        this.throwIfDisposed();
        this.cache.set(key, value);
    }

    get(key: K): V | undefined;
    get(key: K, provider: () => V): V;
    get(key: K, provider?: () => V): V | undefined {
        this.throwIfDisposed();
        if (this.cache.has(key)) {
            return this.cache.get(key);
        } else if (provider) {
            const value = provider();
            this.cache.set(key, value);
            return value;
        } else {
            return undefined;
        }
    }

    delete(key: K): boolean {
        this.throwIfDisposed();
        return this.cache.delete(key);
    }

    clear(): void {
        this.throwIfDisposed();
        this.cache.clear();
    }
}

export class ContextCache<I, C, K, V> extends DisposableCache {

    private cache = new Map<C, Map<K, V>>();
    private converter: (input: I) => C;

    constructor(disposable: Disposable, converter: (input: I) => C) {
        super(disposable);
        this.converter = converter;
    }

    has(contextKey: I, key: K): boolean {
        this.throwIfDisposed();
        return this.getDocumentCache(contextKey).has(key);
    }

    set(contextKey: I, key: K, value: V): void {
        this.throwIfDisposed();
        this.getDocumentCache(contextKey).set(key, value);
    }

    get(contextKey: I, key: K): V | undefined;
    get(contextKey: I, key: K, provider: () => V): V;
    get(contextKey: I, key: K, provider?: () => V): V | undefined {
        this.throwIfDisposed();
        const documentCache = this.getDocumentCache(contextKey);
        if (documentCache.has(key)) {
            return documentCache.get(key);
        } else if (provider) {
            const value = provider();
            documentCache.set(key, value);
            return value;
        } else {
            return undefined;
        }
    }

    delete(contextKey: I, key: K): boolean {
        this.throwIfDisposed();
        return this.getDocumentCache(contextKey).delete(key);
    }

    clear(): void;
    clear(contextKey: I): void;
    clear(contextKey?: I): void {
        this.throwIfDisposed();
        if (contextKey) {
            this.getDocumentCache(contextKey).clear();
        } else {
            this.cache.clear();
        }
    }

    protected getDocumentCache(contextKey: I): Map<K, V> {
        const mapKey = this.converter(contextKey);
        let documentCache = this.cache.get(mapKey);
        if (!documentCache) {
            documentCache = new Map();
            this.cache.set(mapKey, documentCache);
        }
        return documentCache;
    }
}

/**
 * Every key/value pair in this cache is scoped to a document.
 * If this document is changed or deleted, all associated key/value pairs are deleted.
 */
export class DocumentCache<K, V> extends ContextCache<URI | string, string, K, V> {
    constructor(sharedServices: LangiumSharedServices) {
        super(sharedServices.workspace.DocumentBuilder.onUpdate((changed, deleted) => {
            const allUris = changed.concat(deleted);
            for (const uri of allUris) {
                this.clear(uri);
            }
        }), uri => uri.toString());
    }
}

/**
 * Every key/value pair in this cache is scoped to the whole workspace.
 * If any document in the workspace changes, the whole cache is evicted.
 */
export class WorkspaceCache<K, V> extends SimpleCache<K, V> {
    constructor(sharedServices: LangiumSharedServices) {
        super(sharedServices.workspace.DocumentBuilder.onUpdate(() => {
            this.clear();
        }));
    }
}
