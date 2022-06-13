/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { SemanticTokens, SemanticTokenTypes } from 'vscode-languageserver';
import { LangiumDocument } from '..';
import { AbstractSemanticTokenProvider, AllSemanticTokenTypes, SemanticTokenAcceptor } from '../lsp/semantic-token-provider';
import { AstNode } from '../syntax-tree';
import { isAction, isAssignment, isAtomType, isParameter, isParameterReference, isReturnType } from './generated/ast';

export class LangiumGrammarSemanticTokenProvider extends AbstractSemanticTokenProvider {

    protected highlightElement(node: AstNode, acceptor: SemanticTokenAcceptor): void {
        if (isAssignment(node)) {
            acceptor({
                node,
                feature: 'feature',
                type: SemanticTokenTypes.property
            });
        } else if (isAction(node)) {
            if (node.feature) {
                acceptor({
                    node,
                    feature: 'feature',
                    type: SemanticTokenTypes.property
                });
            }
        } else if (isReturnType(node)) {
            acceptor({
                node,
                feature: 'name',
                type: SemanticTokenTypes.type
            });
        } else if (isAtomType(node)) {
            if (node.primitiveType || node.refType) {
                acceptor({
                    node,
                    feature: 'primitiveType' in node ? 'primitiveType' : 'refType',
                    type: SemanticTokenTypes.type
                });
            }
        } else if (isParameter(node)) {
            acceptor({
                node,
                feature: 'name',
                type: SemanticTokenTypes.parameter
            });
        } else if (isParameterReference(node)) {
            acceptor({
                node,
                feature: 'parameter',
                type: SemanticTokenTypes.parameter
            });
        }
    }

}

export interface DecodedSemanticToken {
    offset: number;
    tokenType: SemanticTokenTypes;
    tokenModifiers: number;
    text: string;
}

export class SemanticTokensDecoder {
    static decode<T extends AstNode = AstNode>(tokens: SemanticTokens, document: LangiumDocument<T>): DecodedSemanticToken[] {
        const typeMap = new Map<number, SemanticTokenTypes>();
        Object.entries(AllSemanticTokenTypes).forEach(([type, index]) => typeMap.set(index, type as SemanticTokenTypes));
        let line = 0;
        let character = 0;
        return this.sliceIntoChunks(tokens.data, 5).map(t => {
            line += t[0];
            if (t[0] !== 0) {
                character = 0;
            }
            character += t[1];
            const length = t[2];
            const offset = document.textDocument.offsetAt({ line, character });
            return {
                offset,
                tokenType: typeMap.get(t[3])!,
                tokenModifiers: t[4],
                text: document.textDocument.getText({ start: { line, character }, end: { line, character: character + length } })
            } as DecodedSemanticToken;
        });
    }

    private static sliceIntoChunks<T>(arr: T[], chunkSize: number) {
        const res = [];
        for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.slice(i, i + chunkSize);
            res.push(chunk);
        }
        return res;
    }
}