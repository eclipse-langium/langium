/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Range } from 'vscode-languageserver-types';
import { CompletionItemKind } from 'vscode-languageserver-types';
import type { NextFeature } from '../../lsp';
import type { CompletionAcceptor, CompletionContext } from '../../lsp/completion/completion-provider';
import { DefaultCompletionProvider } from '../../lsp/completion/completion-provider';
import type { LangiumServices } from '../../services';
import type { MaybePromise} from '../../utils';
import { getContainerOfType} from '../../utils';
import { equalURI } from '../../utils';
import type { LangiumDocument, LangiumDocuments } from '../../workspace';
import type { AbstractElement } from '../generated/ast';
import { isAssignment } from '../generated/ast';
import { Utils } from 'vscode-uri';

export class LangiumGrammarCompletionProvider extends DefaultCompletionProvider {

    private readonly documents: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    protected override completionFor(context: CompletionContext, next: NextFeature<AbstractElement>, acceptor: CompletionAcceptor): MaybePromise<void> {
        const feature = getContainerOfType(next.feature, isAssignment);
        if (feature?.feature === 'path') {
            this.completeImportPath(context, acceptor);
        } else {
            return super.completionFor(context, next, acceptor);
        }
    }

    private completeImportPath(context: CompletionContext, acceptor: CompletionAcceptor): void {
        const text = context.textDocument.getText();
        const existingText = text.substring(context.tokenOffset, context.offset);
        let allPaths = this.getAllFiles(context.document);
        let range: Range = {
            start: context.position,
            end: context.position
        };
        if (existingText.length > 0) {
            const existingPath = existingText.substring(1);
            allPaths = allPaths.filter(path => path.startsWith(existingPath));
            // Completely replace the current token
            const start = context.textDocument.positionAt(context.tokenOffset + 1);
            const end = context.textDocument.positionAt(context.tokenEndOffset);
            range = {
                start,
                end
            };
        }
        for (const path of allPaths) {
            // Only insert quotes if there is no `path` token yet.
            const delimiter = existingText.length > 0 ? '' : '"';
            const completionValue = `${delimiter}${path}${delimiter}`;
            acceptor({
                label: path,
                textEdit: {
                    newText: completionValue,
                    range
                },
                kind: CompletionItemKind.File,
                sortText: '0'
            });
        }
    }

    private getAllFiles(document: LangiumDocument): string[] {
        const documents = this.documents.all;
        const uri = document.uri.toString();
        const dirname = Utils.dirname(document.uri).toString();
        const paths: string[] = [];
        for (const doc of documents) {
            if (!equalURI(doc.uri, uri)) {
                const docUri = doc.uri.toString();
                const uriWithoutExt = docUri.substring(0, docUri.length - Utils.extname(doc.uri).length);
                const relativePath = this.createRelativePath(dirname, uriWithoutExt);
                paths.push(relativePath);
            }
        }
        return paths;
    }

    private createRelativePath(fromPath: string, toPath: string): string {
        const fromParts = fromPath.split('/');
        const toParts = toPath.split('/');

        // Remove common parts from the beginning of the paths
        while (fromParts.length > 0 && toParts.length > 0 && fromParts[0] === toParts[0]) {
            fromParts.shift();
            toParts.shift();
        }

        // Calculate the number of directories to navigate up from the 'fromPath'
        const navigateUpCount = fromParts.length;

        // Create the relative path by navigating up and then appending the remaining path from 'toPath'
        let relativePath = '';
        for (let i = 0; i < navigateUpCount; i++) {
            relativePath += '../';
        }
        relativePath += toParts.join('/');

        // Prepend ./ for files that are located in the current directory
        if (!relativePath.startsWith('..')) {
            relativePath = `./${relativePath}`;
        }

        return relativePath;
    }

}
