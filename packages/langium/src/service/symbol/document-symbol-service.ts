import { DocumentSymbol, SymbolKind } from 'vscode-languageserver';
import { LangiumDocument } from '../../documents/document';
import { findNodeForFeature } from '../../grammar/grammar-util';
import { AstNode, CstNode } from '../../syntax-tree';
import { streamContents } from '../../utils/ast-util';

export interface DocumentSymbolProvider {
    getSymbols(document: LangiumDocument): DocumentSymbol[];
}

export class DefaultDocumentSymbolProvider implements DocumentSymbolProvider {

    getSymbols(document: LangiumDocument): DocumentSymbol[] {
        if (document.parseResult) {
            const symbol = this.getSymbol(document, document.parseResult.value);
            if (Array.isArray(symbol)) {
                return symbol;
            } else if (symbol) {
                return [symbol];
            } else {
                return [];
            }
        } else {
            return [];
        }
    }

    protected getSymbol(document: LangiumDocument, astNode: AstNode): DocumentSymbol | DocumentSymbol[] | undefined {
        const node = astNode.$cstNode;
        const name = this.getSignificantFeature(astNode);
        if (name && node) {
            return {
                kind: this.getSymbolKind(astNode.$type),
                name: name.text,
                range: {
                    start: document.positionAt(node.offset),
                    end: document.positionAt(node.offset + node.length)
                },
                selectionRange: {
                    start: document.positionAt(name.offset),
                    end: document.positionAt(name.offset + name.length)
                },
                children: this.getChildSymbols(document, astNode)
            };
        }
        return undefined;
    }

    protected getSignificantFeature(astNode: AstNode): CstNode | undefined {
        return findNodeForFeature(astNode.$cstNode, 'name');
    }

    protected getChildSymbols(document: LangiumDocument, astNode: AstNode): DocumentSymbol[] {
        const children: DocumentSymbol[] = [];

        for (const child of Array.from(streamContents(astNode))) {
            const result = this.getSymbol(document, child.node);
            if (Array.isArray(result)) {
                children.push(...result);
            } else if (result) {
                children.push(result);
            }
        }
        return children;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected getSymbolKind(type: string): SymbolKind {
        return SymbolKind.Field;
    }
}
