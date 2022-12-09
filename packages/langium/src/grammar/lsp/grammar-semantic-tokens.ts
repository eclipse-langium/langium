/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { SemanticTokenTypes } from 'vscode-languageserver';
import { AstNode } from '../../syntax-tree';
import { AbstractSemanticTokenProvider, SemanticTokenAcceptor } from '../../lsp/semantic-token-provider';
import { isAction, isAssignment, isAtomType, isParameter, isParameterReference, isReturnType, isRuleCall, isTypeAttribute } from '../generated/ast';

export class LangiumGrammarSemanticTokenProvider extends AbstractSemanticTokenProvider {

    protected highlightElement(node: AstNode, acceptor: SemanticTokenAcceptor): void {
        if (isAssignment(node)) {
            acceptor({
                node,
                property: 'feature',
                type: SemanticTokenTypes.property
            });
        } else if (isAction(node)) {
            if (node.feature) {
                acceptor({
                    node,
                    property: 'feature',
                    type: SemanticTokenTypes.property
                });
            }
        } else if (isReturnType(node)) {
            acceptor({
                node,
                property: 'name',
                type: SemanticTokenTypes.type
            });
        } else if (isAtomType(node)) {
            if (node.primitiveType || node.refType) {
                acceptor({
                    node,
                    property: node.primitiveType ? 'primitiveType' : 'refType',
                    type: SemanticTokenTypes.type
                });
            }
        } else if (isParameter(node)) {
            acceptor({
                node,
                property: 'name',
                type: SemanticTokenTypes.parameter
            });
        } else if (isParameterReference(node)) {
            acceptor({
                node,
                property: 'parameter',
                type: SemanticTokenTypes.parameter
            });
        } else if (isRuleCall(node)) {
            if (node.rule.ref?.fragment) {
                acceptor({
                    node,
                    property: 'rule',
                    type: SemanticTokenTypes.type
                });
            }
        } else if (isTypeAttribute(node)) {
            acceptor({
                node,
                property: 'name',
                type: SemanticTokenTypes.property
            });
        }
    }

}
