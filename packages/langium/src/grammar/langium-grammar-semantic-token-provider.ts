/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { SemanticTokenTypes } from 'vscode-languageserver';
import { AbstractSemanticTokenProvider } from '../lsp/semantic-token-provider';
import { AstNode } from '../syntax-tree';
import { isAction, isAssignment, isParameter, isParameterReference, isParserRule, isTerminalRule } from './generated/ast';
import { isDataTypeRule } from './grammar-util';

export class LangiumGrammarSemanticTokenProvider extends AbstractSemanticTokenProvider {

    protected highlightElement(node: AstNode): boolean {
        if (isAssignment(node)) {
            this.highlightFeature(node, 'feature', SemanticTokenTypes.property);
        } else if (isAction(node)) {
            if (node.feature) {
                this.highlightFeature(node, 'feature', SemanticTokenTypes.property);
            }
        } else if ((isParserRule(node) && isDataTypeRule(node) || isTerminalRule(node)) && node.type) {
            this.highlightFeature(node, 'type', SemanticTokenTypes.type);
        } else if (isParameter(node)) {
            this.highlightFeature(node, 'name', SemanticTokenTypes.parameter);
        } else if (isParameterReference(node)) {
            this.highlightFeature(node, 'parameter', SemanticTokenTypes.parameter);
        }
        return false;
    }

}
