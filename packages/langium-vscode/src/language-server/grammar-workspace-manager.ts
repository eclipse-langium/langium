/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import ignore, { Ignore } from 'ignore';
import { LangiumGrammarLanguageMetaData } from 'langium/lib/grammar/generated/module';
import { LangiumSharedServices } from 'langium/lib/services';
import { ConfigurationProvider } from 'langium/lib/workspace/configuration';
import { FileSystemNode } from 'langium/lib/workspace/file-system-provider';
import { DefaultWorkspaceManager } from 'langium/lib/workspace/workspace-manager';
import * as path from 'path';
import { CancellationToken, WorkspaceFolder } from 'vscode-languageserver-protocol';
import { URI, Utils } from 'vscode-uri';

const CONFIG_KEY = 'build';

interface WorkspaceManagerConf {
    /**
     * gitignore-style exclusion patterns, separated by comma
     */
    ignorePatterns: string
}

export class LangiumGrammarWorkspaceManager extends DefaultWorkspaceManager {

    protected readonly configurationProvider: ConfigurationProvider;
    protected matcher: Ignore | undefined;

    constructor(services: LangiumSharedServices) {
        super(services);
        this.configurationProvider = services.workspace.ConfigurationProvider;
    }

    async initializeWorkspace(folders: WorkspaceFolder[], cancelToken = CancellationToken.None): Promise<void> {
        const buildConf: WorkspaceManagerConf = await this.configurationProvider.getConfiguration(LangiumGrammarLanguageMetaData.languageId, CONFIG_KEY);
        const ignorePatterns = buildConf.ignorePatterns?.split(',')?.map(pattern => pattern.trim())?.filter(pattern => pattern.length > 0);
        this.matcher = ignorePatterns ? ignore().add(ignorePatterns) : undefined;
        return super.initializeWorkspace(folders, cancelToken);
    }

    protected includeEntry(workspaceFolder: WorkspaceFolder, entry: FileSystemNode, fileExtensions: string[]): boolean {
        if (this.matcher) {
            // create path relative to workspace folder root: /user/foo/workspace/entry.txt -> entry.txt
            const relPath = path.relative(URI.parse(workspaceFolder.uri).path, entry.uri.path);
            const ignored = this.matcher.ignores(relPath);
            return !ignored && (entry.isDirectory || (entry.isFile && fileExtensions.includes(Utils.extname(entry.uri))));
        }
        return super.includeEntry(workspaceFolder, entry, fileExtensions);
    }

}
