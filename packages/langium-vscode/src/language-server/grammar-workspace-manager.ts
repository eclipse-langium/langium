/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Ignore } from 'ignore';
import ignore from 'ignore';
import type { ConfigurationProvider, FileSystemNode, WorkspaceFolder } from 'langium';
import { Cancellation, DefaultWorkspaceManager, URI, UriUtils } from 'langium';
import type { LangiumSharedServices } from 'langium/lsp';
import * as path from 'path';

const CONFIG_KEY = 'build';

interface WorkspaceManagerConf {
    /**
     * gitignore-style exclusion patterns, separated by comma
     */
    ignorePatterns: string
}

function isWorkspaceManagerConf(item: unknown): item is WorkspaceManagerConf {
    if (typeof item !== 'object' || !item) {
        return false;
    }
    const conf = item as WorkspaceManagerConf;
    return typeof conf.ignorePatterns === 'string';
}

export class LangiumGrammarWorkspaceManager extends DefaultWorkspaceManager {

    protected readonly configurationProvider: ConfigurationProvider;
    protected matcher: Ignore | undefined;

    constructor(services: LangiumSharedServices) {
        super(services);
        this.configurationProvider = services.workspace.ConfigurationProvider;
    }

    override async initializeWorkspace(folders: WorkspaceFolder[], cancelToken = Cancellation.CancellationToken.None): Promise<void> {
        const buildConf: unknown = await this.configurationProvider.getConfiguration('langium', CONFIG_KEY);
        if (isWorkspaceManagerConf(buildConf)) {
            const ignorePatterns = buildConf.ignorePatterns
                .split(',')
                .map(pattern => pattern.trim())
                .filter(pattern => pattern.length > 0);
            if (ignorePatterns.length > 0) {
                this.matcher = ignore.default().add(ignorePatterns);
            }
        }
        return super.initializeWorkspace(folders, cancelToken);
    }

    protected override includeEntry(workspaceFolder: WorkspaceFolder, entry: FileSystemNode, fileExtensions: string[]): boolean {
        if (this.matcher) {
            // create path relative to workspace folder root: /user/foo/workspace/entry.txt -> entry.txt
            const relPath = path.relative(URI.parse(workspaceFolder.uri).path, entry.uri.path);
            const ignored = this.matcher.ignores(relPath);
            return !ignored && (entry.isDirectory || (entry.isFile && fileExtensions.includes(UriUtils.extname(entry.uri))));
        }
        return super.includeEntry(workspaceFolder, entry, fileExtensions);
    }

}
