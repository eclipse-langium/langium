/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumDocument, MaybePromise } from 'langium';
import type { Position } from 'vscode-languageserver';
import type { DocumentHighlight, DocumentHighlightParams } from 'vscode-languageserver';
import type { LangiumSprottyServices } from './sprotty-services.js';
import { DefaultDocumentHighlightProvider } from 'langium/lsp';

/**
 * This service provides access to the user's current cursor position.
 */
export interface PositionTracker {

    firePositionChanged(document: LangiumDocument, position: Position): void;

    onPositionChanged(listener: PositionChangeListener): void;

    removePositionChangeListener(listener: PositionChangeListener): void;

    getOffset(document: LangiumDocument): number | undefined;

}

export type PositionChangeListener = (document: LangiumDocument, position: Position) => void;

export class DefaultPositionTracker {

    protected readonly positionMap = new Map<string, Position>();
    protected readonly positionChangeListeners: PositionChangeListener[] = [];

    constructor(services: LangiumSprottyServices) {
        services.shared.workspace.TextDocuments.onDidClose(event => {
            this.positionMap.delete(event.document.uri.toString());
        });
    }

    firePositionChanged(document: LangiumDocument, position: Position): void {
        this.positionMap.set(document.uri.toString(), position);
        this.positionChangeListeners.forEach(listener => listener(document, position));
    }

    onPositionChanged(listener: PositionChangeListener): void {
        this.positionChangeListeners.push(listener);
    }

    removePositionChangeListener(listener: PositionChangeListener): void {
        const index = this.positionChangeListeners.indexOf(listener);
        if (index >= 0) {
            this.positionChangeListeners.splice(index, 1);
        }
    }

    getOffset(document: LangiumDocument): number | undefined {
        const position = this.positionMap.get(document.uri.toString());
        if (!position) {
            return undefined;
        }
        return document.textDocument.offsetAt(position);
    }

}

/**
 * Exploit the client's document highlight requests to track cursor positions.
 * Known limitation: document highlight requests are not sent when the cursor is surrounded by whitespace.
 */
export class TrackingDocumentHighlightProvider extends DefaultDocumentHighlightProvider {

    private readonly positionTracker: PositionTracker;

    constructor(services: LangiumSprottyServices) {
        super(services);
        this.positionTracker = services.diagram.PositionTracker;
    }

    override getDocumentHighlight(document: LangiumDocument, params: DocumentHighlightParams): MaybePromise<DocumentHighlight[] | undefined> {
        this.positionTracker.firePositionChanged(document, params.position);
        return super.getDocumentHighlight(document, params);
    }

}
