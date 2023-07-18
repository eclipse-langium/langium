/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Disposable } from 'vscode-languageserver';
import type { URI } from 'vscode-uri';
import type { LangiumSharedServices } from '../services';
import type { DocumentBuilder } from '../workspace';

/**
 * Service for simplying workspace based caching.
 * Contains methods to create caches that are scoped to different levels of a workspace.
 */
export interface CachingService {
    /**
     * Creates a cache that is scoped to documents. See {@link DocumentCache}
     */
    createDocumentCache<K, V>(): DocumentCache<K, V>;
    /**
     * Creates a cache that is scoped to the workspace. See {@link WorkspaceCache}
     */
    createWorkspaceCache<K, V>(): WorkspaceCache<K, V>;
}

/**
 * Every key/value pair in this cache is scoped to a document.
 * If this document is changed or deleted, all associated key/value pairs are deleted.
 */
export interface DocumentCache<K, V> extends Disposable {
    has(documentUri: URI | string, key: K): boolean;
    set(documentUri: URI | string, key: K, value: V): void;
    get(documentUri: URI | string, key: K): V | undefined;
    get(documentUri: URI | string, key: K, provider: () => V): V;
    delete(documentUri: URI | string, key: K): boolean;
    clear(): void;
    clear(documentUri: URI | string): void;
}

/**
 * Every key/value pair in this cache is scoped to the whole workspace.
 * If any document in the workspace changes, the whole cache is evicted.
 */
export interface WorkspaceCache<K, V> extends Disposable {
    has(key: K): boolean;
    set(key: K, value: V): void;
    get(key: K): V | undefined;
    get(key: K, provider: () => V): V;
    delete(key: K): boolean;
    clear(): void;
}

export class DefaultCachingService implements CachingService {

    protected readonly documentBuilder: DocumentBuilder;

    constructor(services: LangiumSharedServices) {
        this.documentBuilder = services.workspace.DocumentBuilder;
    }

    createDocumentCache<K, V>(): DocumentCache<K, V> {
        const cache = new DocumentCacheImpl<K, V>(this.documentBuilder.onUpdate((changed, deleted) => {
            const allUris = changed.concat(deleted);
            for (const uri of allUris) {
                cache.clear(uri);
            }
        }));
        return cache;
    }
    createWorkspaceCache<K, V>(): WorkspaceCache<K, V> {
        const cache = new WorkspaceCacheImpl<K, V>(this.documentBuilder.onUpdate(() => {
            cache.clear();
        }));
        return cache;
    }
}

export class DisposableCache implements Disposable {

    protected toDispose: Disposable;
    protected isDisposed = false;

    constructor(disposable: Disposable) {
        this.toDispose = disposable;
    }

    dispose(): void {
        this.throwIfDisposed();
        this.isDisposed = true;
        this.toDispose.dispose();
    }

    throwIfDisposed(): void {
        if (this.isDisposed) {
            throw new Error('This cache has already been disposed');
        }
    }
}

export class DocumentCacheImpl<K, V> extends DisposableCache implements DocumentCache<K, V> {

    protected cache = new Map<string, Map<K, V>>();

    has(documentUri: URI | string, key: K): boolean {
        this.throwIfDisposed();
        return this.getDocumentCache(documentUri).has(key);
    }

    set(documentUri: URI | string, key: K, value: V): void {
        this.throwIfDisposed();
        this.getDocumentCache(documentUri).set(key, value);
    }

    get(documentUri: URI | string, key: K): V | undefined;
    get(documentUri: URI | string, key: K, provider: () => V): V;
    get(documentUri: URI | string, key: K, provider?: () => V): V | undefined {
        this.throwIfDisposed();
        const documentCache = this.getDocumentCache(documentUri);
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

    delete(documentUri: URI | string, key: K): boolean {
        this.throwIfDisposed();
        return this.getDocumentCache(documentUri).delete(key);
    }

    clear(): void;
    clear(documentUri: URI | string): void;
    clear(documentUri?: URI | string): void {
        this.throwIfDisposed();
        if (documentUri) {
            this.getDocumentCache(documentUri).clear();
        } else {
            this.cache.clear();
        }
    }

    protected getDocumentCache(uri: URI | string): Map<K, V> {
        const uriString = uri.toString();
        let documentCache = this.cache.get(uriString);
        if (!documentCache) {
            documentCache = new Map();
            this.cache.set(uriString, documentCache);
        }
        return documentCache;
    }
}

export class WorkspaceCacheImpl<K, V> extends DisposableCache implements WorkspaceCache<K, V> {

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
