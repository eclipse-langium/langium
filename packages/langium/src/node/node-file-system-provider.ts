/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import { URI, Utils } from 'vscode-uri';
import { FileSystemNode, FileSystemProvider } from '../workspace/file-system-provider';

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

export const NodeFileSystem = {
    fileSystemProvider: () => new NodeFileSystemProvider()
};
