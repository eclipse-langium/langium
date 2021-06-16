/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Location, Position } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { ReferenceFinder } from './reference-finder';

export interface DocumentHighlighter {
    findReferences(document: LangiumDocument, position: Position): CstNode[];
    findHighlightLocations(document: LangiumDocument, position: Position): Location[];
}

export class DefaultDocumentHighlighter implements DocumentHighlighter {
    protected readonly referenceFinder: ReferenceFinder;

    constructor(services: LangiumServices) {
        this.referenceFinder = services.references.ReferenceFinder;
    }

    findReferences(document: LangiumDocument, position: Position): CstNode[] {
        return this.referenceFinder.findReferences(document, position, true);
    }

    findHighlightLocations(document: LangiumDocument, position: Position): Location[] {
        return this.referenceFinder.findReferenceLocations(document, position, true);
    }
}
