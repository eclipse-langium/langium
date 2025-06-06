/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { URI } from '../utils/uri-utils.js';

export interface FileSystemNode {
    readonly isFile: boolean;
    readonly isDirectory: boolean;
    readonly uri: URI;
}

export type FileSystemFilter = (node: FileSystemNode) => boolean;

/**
 * Provides methods to interact with an abstract file system. The default implementation is based on the node.js `fs` API.
 */
export interface FileSystemProvider {
    /**
     * Gets the status of a file or directory.
     * The status includes meta data such as whether the node is a file or directory.
     * @param uri The URI of the file or directory.
     */
    stat(uri: URI): Promise<FileSystemNode>;
    /**
     * Gets the status of a file or directory synchronously.
     * The status includes meta data such as whether the node is a file or directory.
     * @param uri The URI of the file or directory.
     */
    statSync(uri: URI): FileSystemNode;
    /**
     * Reads a document asynchronously from a given URI.
     * @returns The string content of the file with the specified URI.
     */
    readFile(uri: URI): Promise<string>;
    /**
     * Reads the directory information for the given URI.
     * @returns The list of file system entries that are contained within the specified directory.
     */
    readDirectory(uri: URI): Promise<FileSystemNode[]>;
}

export class EmptyFileSystemProvider implements FileSystemProvider {

    stat(_uri: URI): Promise<FileSystemNode> {
        throw new Error('No file system is available.');
    }

    statSync(_uri: URI): FileSystemNode {
        throw new Error('No file system is available.');
    }

    readFile(): Promise<string> {
        throw new Error('No file system is available.');
    }

    async readDirectory(): Promise<FileSystemNode[]> {
        return [];
    }

}

export const EmptyFileSystem = {
    fileSystemProvider: () => new EmptyFileSystemProvider()
};
