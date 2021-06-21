/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DocumentHighlightParams, Location } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { LangiumServices } from '../services';
import { ReferenceFinder } from './reference-finder';

export interface DocumentHighlighter {
    findHighlights(document: LangiumDocument, params: DocumentHighlightParams): Location[];
}

export class DefaultDocumentHighlighter implements DocumentHighlighter {
    protected readonly referenceFinder: ReferenceFinder;

    constructor(services: LangiumServices) {
        this.referenceFinder = services.references.ReferenceFinder;
    }

    findHighlights(document: LangiumDocument, params: DocumentHighlightParams): Location[] {
        return this.referenceFinder.findReferences(document, params, true);
    }
}
