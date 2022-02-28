/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { SemanticTokenTypes } from 'vscode-languageserver';
import { AbstractSemanticTokenProvider, SemanticTokenAcceptor } from '../lsp/semantic-token-provider';
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
            acceptor({
                node,
                feature: 'primitiveType',
                type: SemanticTokenTypes.type
            });
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
