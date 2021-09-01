/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DocumentSymbol, SymbolKind } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { NameProvider } from '../references/naming';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { streamContents } from '../utils/ast-util';

export interface DocumentSymbolProvider {
    getSymbols(document: LangiumDocument): DocumentSymbol[];
}

export class DefaultDocumentSymbolProvider implements DocumentSymbolProvider {

    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    getSymbols(document: LangiumDocument): DocumentSymbol[] {
        if (document.parseResult) {
            return this.getSymbol(document, document.parseResult.value);
        } else {
            return [];
        }
    }

    protected getSymbol(document: LangiumDocument, astNode: AstNode): DocumentSymbol[] {
        const node = astNode.$cstNode;
        const nameNode = this.nameProvider.getNameNode(astNode);
        if (nameNode && node) {
            const name = this.nameProvider.getName(astNode);
            return [{
                kind: this.getSymbolKind(astNode.$type),
                name: name ?? nameNode.text,
                range: {
                    start: document.positionAt(node.offset),
                    end: document.positionAt(node.offset + node.length)
                },
                selectionRange: {
                    start: document.positionAt(nameNode.offset),
                    end: document.positionAt(nameNode.offset + nameNode.length)
                },
                children: this.getChildSymbols(document, astNode)
            }];
        } else {
            return this.getChildSymbols(document, astNode) || [];
        }
    }

    protected getChildSymbols(document: LangiumDocument, astNode: AstNode): DocumentSymbol[] | undefined {
        const children: DocumentSymbol[] = [];

        for (const child of streamContents(astNode)) {
            const result = this.getSymbol(document, child.node);
            children.push(...result);
        }
        if (children.length > 0) {
            return children;
        }
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected getSymbolKind(type: string): SymbolKind {
        return SymbolKind.Field;
    }
}
