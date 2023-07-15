/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Disposable } from 'vscode-languageserver';
import type { URI } from 'vscode-uri';
import type { LangiumSharedServices } from '../services';
import type { DocumentBuilder } from '../workspace';

export interface CachingService {
    createDocumentCache<K, V>(): DocumentCache<K, V>;
    createWorkspaceCache<K, V>(): WorkspaceCache<K, V>;
}

export interface DocumentCache<K, V> extends Disposable {
    has(documentUri: URI, key: K): boolean;
    set(documentUri: URI, key: K, value: V): void;
    get(documentUri: URI, key: K): V | undefined;
    delete(documentUri: URI, key: K): boolean;
    clear(): void;
    clear(documentUri: URI): void;
}

export interface WorkspaceCache<K, V> extends Disposable {
    has(key: K): boolean;
    set(key: K, value: V): void;
    get(key: K): V | undefined;
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

    has(documentUri: URI, key: K): boolean {
        this.throwIfDisposed();
        return this.getDocumentCache(documentUri).has(key);
    }

    set(documentUri: URI, key: K, value: V): void {
        this.throwIfDisposed();
        this.getDocumentCache(documentUri).set(key, value);
    }

    get(documentUri: URI, key: K): V | undefined {
        this.throwIfDisposed();
        return this.getDocumentCache(documentUri).get(key);
    }

    delete(documentUri: URI, key: K): boolean {
        this.throwIfDisposed();
        return this.getDocumentCache(documentUri).delete(key);
    }

    clear(): void;
    clear(documentUri: URI): void;
    clear(documentUri?: URI): void {
        this.throwIfDisposed();
        if (documentUri) {
            this.getDocumentCache(documentUri).clear();
        } else {
            this.cache.clear();
        }
    }

    protected getDocumentCache(uri: URI): Map<K, V> {
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

    get(key: K): V | undefined {
        this.throwIfDisposed();
        return this.cache.get(key);
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
