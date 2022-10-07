/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefaultFoldingRangeProvider } from '../../lsp/folding-range-provider';
import { AstNode } from '../../syntax-tree';
import { isParserRule } from '../generated/ast';

/**
 * A specialized folding range provider for the grammar language
 */
export class LangiumGrammarFoldingRangeProvider extends DefaultFoldingRangeProvider {

    override shouldProcessContent(node: AstNode): boolean {
        // Exclude parser rules from folding
        return !isParserRule(node);
    }
}
