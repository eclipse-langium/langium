/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Position } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { ReferenceFinder } from './reference-finder';

export interface DocumentHighlighter {
    findHighlights(document: LangiumDocument, position: Position): CstNode[];
}

export class DefaultDocumentHighlighter implements DocumentHighlighter {
    protected readonly referenceFinder: ReferenceFinder;

    constructor(services: LangiumServices) {
        this.referenceFinder = services.references.ReferenceFinder;
    }

    findHighlights(document: LangiumDocument, position: Position): CstNode[] {
        return this.referenceFinder.findReferences(document, position, true);
    }
}
