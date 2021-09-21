/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { AstNode } from '../syntax-tree';
import { LangiumParser, ParseResult } from '../parser/langium-parser';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices, LanguageMetaData, Stream, stream } from '..';
import { URI } from 'vscode-uri';

export interface LangiumDocument {
    parseResult: ParseResult
    precomputedScopes?: PrecomputedScopes
    valid: boolean
    textDocument: TextDocument
    uri: URI
}

export type PrecomputedScopes = Map<AstNode, AstNodeDescription[]>

export interface TextDocumentFactory {
    fromUri(uri: URI): TextDocument;
}

export class DefaultTextDocumentFactory implements TextDocumentFactory {

    protected readonly languageMetaData: LanguageMetaData;

    constructor(services: LangiumServices) {
        this.languageMetaData = services.LanguageMetaData;
    }

    fromUri(uri: URI): TextDocument {
        const content = fs.readFileSync(uri.fsPath, 'utf-8');
        return TextDocument.create(uri.toString(), this.languageMetaData.languageId, 0, content);
    }

}

export interface LangiumDocumentFactory {
    fromTextDocument(textDocument: TextDocument): LangiumDocument;
}

export class DefaultLangiumDocumentFactory implements LangiumDocumentFactory {

    protected readonly parser: LangiumParser;

    constructor(services: LangiumServices) {
        this.parser = services.parser.LangiumParser;
    }

    fromTextDocument(textDocument: TextDocument): LangiumDocument {
        const doc: LangiumDocument = {
            valid: true,
            textDocument,
            uri: URI.parse(textDocument.uri),
            parseResult: undefined!
        };
        const parseResult = this.parser.parse(doc);
        doc.parseResult = parseResult;
        return doc;
    }
}

export interface LangiumDocuments {
    readonly all: Stream<LangiumDocument>
    getOrCreateDocument(uri: URI): LangiumDocument;
    invalidateDocument(uri: URI): void;
}

export class DefaultLangiumDocuments implements LangiumDocuments {

    protected readonly documentMap: Map<string, LangiumDocument> = new Map();
    protected readonly textDocuments: TextDocuments<TextDocument>;
    protected readonly textDocumentFactory: TextDocumentFactory;
    protected readonly langiumDocumentFactory: LangiumDocumentFactory;

    constructor(services: LangiumServices) {
        this.textDocuments = services.documents.TextDocuments;
        this.textDocumentFactory = services.documents.TextDocumentFactory;
        this.langiumDocumentFactory = services.documents.LangiumDocumentFactory;
    }

    get all(): Stream<LangiumDocument> {
        return stream(this.documentMap.values());
    }

    getOrCreateDocument(uri: URI): LangiumDocument {
        const uriString = uri.toString();
        let langiumDoc = this.documentMap.get(uriString);
        if (langiumDoc) {
            return langiumDoc;
        }
        let textDoc = this.textDocuments.get(uriString);
        if (!textDoc) {
            textDoc = this.textDocumentFactory.fromUri(uri);
        }
        langiumDoc = this.langiumDocumentFactory.fromTextDocument(textDoc);
        this.documentMap.set(uriString, langiumDoc);
        return langiumDoc;
    }

    invalidateDocument(uri: URI): void {
        const uriString = uri.toString();
        const langiumDoc = this.documentMap.get(uriString);
        if (langiumDoc) {
            langiumDoc.valid = false;
            this.documentMap.delete(uriString);
        }
    }
}
