/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import { URI, Utils } from 'vscode-uri';

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
     * Reads a document asynchronously from a given URI.
     * @returns The string content of the file with the specified URI.
     */
    readFile(uri: URI): Promise<string>;
    /**
     * Reads a document synchronously from a given URI.
     * @returns The string content of the file with the specified URI.
     */
    readFileSync(uri: URI): string;
    /**
     * Reads the directory information for the given URI.
     * @returns The list of file system entries that are contained within the specified directory.
     */
    readDirectory(uri: URI): Promise<FileSystemNode[]>;
}

export type NodeTextEncoding = 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'latin1';

export class NodeFileSystemProvider implements FileSystemProvider {

    encoding: NodeTextEncoding = 'utf-8';

    readFile(uri: URI): Promise<string> {
        return fs.promises.readFile(uri.fsPath, this.encoding);
    }

    readFileSync(uri: URI): string {
        return fs.readFileSync(uri.fsPath, this.encoding);
    }

    async readDirectory(folderPath: URI): Promise<FileSystemNode[]> {
        const dirents = await fs.promises.readdir(folderPath.fsPath, { withFileTypes: true });
        return dirents.map(dirent => ({
            dirent, // Include the raw entry, it may be useful...
            isFile: dirent.isFile(),
            isDirectory: dirent.isDirectory(),
            uri: Utils.joinPath(folderPath, dirent.name)
        }));
    }
}
