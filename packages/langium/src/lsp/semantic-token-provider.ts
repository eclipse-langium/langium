/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable no-bitwise */

import { CancellationToken, Range, SemanticTokenModifiers, SemanticTokens, SemanticTokensBuilder as BaseSemanticTokensBuilder, SemanticTokensDelta, SemanticTokensDeltaParams, SemanticTokensOptions, SemanticTokensParams, SemanticTokensRangeParams, SemanticTokenTypes } from 'vscode-languageserver';
import { findKeywordNode, findNodeForFeature } from '../grammar/grammar-util';
import { AstNode, CstNode, Properties } from '../syntax-tree';
import { streamAllContents } from '../utils/ast-util';
import { LangiumDocument } from '../workspace/documents';

export const AllSemanticTokenTypes: Record<string, number> = {
    [SemanticTokenTypes.class]: 0,
    [SemanticTokenTypes.comment]: 1,
    [SemanticTokenTypes.enum]: 2,
    [SemanticTokenTypes.enumMember]: 3,
    [SemanticTokenTypes.event]: 4,
    [SemanticTokenTypes.function]: 5,
    [SemanticTokenTypes.interface]: 6,
    [SemanticTokenTypes.keyword]: 7,
    [SemanticTokenTypes.macro]: 8,
    [SemanticTokenTypes.method]: 9,
    [SemanticTokenTypes.modifier]: 10,
    [SemanticTokenTypes.namespace]: 11,
    [SemanticTokenTypes.number]: 12,
    [SemanticTokenTypes.operator]: 13,
    [SemanticTokenTypes.parameter]: 14,
    [SemanticTokenTypes.property]: 15,
    [SemanticTokenTypes.regexp]: 16,
    [SemanticTokenTypes.string]: 17,
    [SemanticTokenTypes.struct]: 18,
    [SemanticTokenTypes.type]: 19,
    [SemanticTokenTypes.typeParameter]: 20,
    [SemanticTokenTypes.variable]: 21
};

export const AllSemanticTokenModifiers: Record<string, number> = {
    [SemanticTokenModifiers.abstract]: 1 << 0,
    [SemanticTokenModifiers.async]: 1 << 1,
    [SemanticTokenModifiers.declaration]: 1 << 2,
    [SemanticTokenModifiers.defaultLibrary]: 1 << 3,
    [SemanticTokenModifiers.definition]: 1 << 4,
    [SemanticTokenModifiers.deprecated]: 1 << 5,
    [SemanticTokenModifiers.documentation]: 1 << 6,
    [SemanticTokenModifiers.modification]: 1 << 7,
    [SemanticTokenModifiers.readonly]: 1 << 8,
    [SemanticTokenModifiers.static]: 1 << 9
};

export const DefaultSemanticTokenOptions: SemanticTokensOptions = {
    legend: {
        tokenTypes: Object.keys(AllSemanticTokenTypes),
        tokenModifiers: Object.keys(AllSemanticTokenModifiers)
    },
    full: {
        delta: true
    },
    range: true
};

export interface SemanticTokenProvider {
    semanticHighlight(document: LangiumDocument, params: SemanticTokensParams, cancelToken?: CancellationToken): SemanticTokens
    semanticHighlightRange(document: LangiumDocument, params: SemanticTokensRangeParams, cancelToken?: CancellationToken): SemanticTokens
    semanticHighlightDelta(document: LangiumDocument, params: SemanticTokensDeltaParams, cancelToken?: CancellationToken): SemanticTokens | SemanticTokensDelta
}

export interface SemanticToken {
    line: number
    char: number
    length: number
    tokenType: number
    tokenModifiers: number
}

export type SemanticTokenAcceptorOptions<N extends AstNode = AstNode> = ({
    line: number
    char: number,
    length: number
} | {
    node: N,
    feature: Properties<N>,
    index?: number
} | {
    node: N,
    keyword: string
} | {
    node: CstNode
}) & {
    type: string
    modifier?: string | string[]
}

export class SemanticTokensBuilder extends BaseSemanticTokensBuilder {
    private _tokens: SemanticToken[] = [];

    override push(line: number, char: number, length: number, tokenType: number, tokenModifiers: number): void {
        this._tokens.push({
            line,
            char,
            length,
            tokenType,
            tokenModifiers
        });
    }

    override build(): SemanticTokens {
        this.applyTokens();
        return super.build();
    }

    override buildEdits(): SemanticTokens | SemanticTokensDelta {
        this.applyTokens();
        return super.buildEdits();
    }

    private applyTokens(): void {
        for (const token of this._tokens.sort(this.compareTokens)) {
            super.push(token.line, token.char, token.length, token.tokenType, token.tokenModifiers);
        }
        this._tokens = [];
    }

    private compareTokens(a: SemanticToken, b: SemanticToken): number {
        if (a.line === b.line) {
            return a.char - b.char;
        }
        return a.line - b.line;
    }
}

export type SemanticTokenAcceptor = <N extends AstNode = AstNode>(options: SemanticTokenAcceptorOptions<N>) => void;

/**
 * A basic super class for providing semantic token data.
 * Users of Langium should extend this class to create their own `SemanticTokenProvider`.
 *
 * The entry method for generating semantic tokens based on an `AstNode` is the `highlightElement` method.
 */
export abstract class AbstractSemanticTokenProvider implements SemanticTokenProvider {

    protected tokenBuilder = new SemanticTokensBuilder();
    protected acceptor: SemanticTokenAcceptor = options => {
        if ('line' in options) {
            this.highlightToken(options.line, options.char, options.length, options.type, options.modifier);
        } else if ('keyword' in options) {
            this.highlightKeyword(options.node, options.keyword, options.type, options.modifier);
        } else if ('feature' in options) {
            this.highlightFeature(options.node, options.feature, options.index, options.type, options.modifier);
        } else {
            this.highlightNode(options.node, options.type, options.modifier);
        }
    };
    protected range?: Range;

    semanticHighlight(document: LangiumDocument, _params: SemanticTokensParams, cancelToken = CancellationToken.None): SemanticTokens {
        this.range = undefined;
        this.resetTokensBuilder();
        this.computeHighlighting(document, this.acceptor, cancelToken);
        return this.tokenBuilder.build();
    }

    semanticHighlightRange(document: LangiumDocument, params: SemanticTokensRangeParams, cancelToken = CancellationToken.None): SemanticTokens {
        this.range = params.range;
        this.resetTokensBuilder();
        this.computeHighlighting(document, this.acceptor, cancelToken);
        return this.tokenBuilder.build();
    }

    semanticHighlightDelta(document: LangiumDocument, params: SemanticTokensDeltaParams, cancelToken = CancellationToken.None): SemanticTokens | SemanticTokensDelta {
        this.range = undefined;
        this.tokenBuilder.previousResult(params.previousResultId);
        this.computeHighlighting(document, this.acceptor, cancelToken);
        return this.tokenBuilder.buildEdits();
    }

    protected resetTokensBuilder(): void {
        this.tokenBuilder.previousResult(Date.now().toString());
    }

    protected computeHighlighting(document: LangiumDocument, acceptor: SemanticTokenAcceptor, cancelToken: CancellationToken): void {
        const root = document.parseResult.value;
        const treeIterator = streamAllContents(root).iterator();
        let result: IteratorResult<AstNode>;
        do {
            result = treeIterator.next();
            if (!result.done) {
                if (cancelToken.isCancellationRequested) {
                    break;
                }
                const node = result.value;
                const nodeRange = node.$cstNode!.range;
                const comparedRange = this.compareRange(nodeRange);
                if (comparedRange === 1) {
                    break; // Every following element will not be in range, so end the loop
                } else if (comparedRange === -1) {
                    continue; // Current element is ending before range starts, skip to next element
                }
                if (this.highlightElement(node, acceptor) === 'prune') {
                    treeIterator.prune();
                }
            }
        } while (!result.done);
    }

    protected compareRange(range: Range | number): number {
        if (!this.range) {
            return 0;
        }
        const startLine = typeof range === 'number' ? range : range.start.line;
        const endLine = typeof range === 'number' ? range : range.end.line;
        if (endLine < this.range.start.line) {
            return -1;
        } else if (startLine > this.range.end.line) {
            return 1;
        } else {
            return 0;
        }
    }

    /**
     * @return `'prune'` to skip the children of this element, nothing otherwise.
     */
    protected abstract highlightElement(node: AstNode, acceptor: SemanticTokenAcceptor): void | undefined | 'prune';

    protected highlightToken(line: number, char: number, length: number, type: string, modifiers?: string | string[]): void {
        if (this.compareRange(line) !== 0) {
            return;
        }
        const intType = AllSemanticTokenTypes[type];
        let totalModifier = 0;
        if (modifiers !== undefined) {
            if (typeof modifiers === 'string') {
                modifiers = [modifiers];
            }
            for (const modifier of modifiers) {
                const intModifier = AllSemanticTokenModifiers[modifier];
                totalModifier |= intModifier;
            }
        }
        this.tokenBuilder.push(line, char, length, intType, totalModifier);
    }

    protected highlightFeature<N extends AstNode>(node: N, feature: Properties<N>, index: number | undefined, type: string, modifiers?: string | string[]): void {
        const featureNode = findNodeForFeature(node.$cstNode, feature as string, index);
        if (featureNode) {
            this.highlightNode(featureNode, type, modifiers);
        }
    }

    protected highlightKeyword(node: AstNode, keyword: string, type: string, modifiers?: string | string[]): void {
        const keywordNode = findKeywordNode(node.$cstNode, keyword);
        if (keywordNode) {
            this.highlightNode(keywordNode, type, modifiers);
        }
    }

    protected highlightNode(node: CstNode, type: string, modifiers?: string | string[]): void {
        const nodeRange = node.range;
        this.highlightToken(
            nodeRange.start.line,
            nodeRange.start.character,
            nodeRange.end.character - nodeRange.start.character,
            type,
            modifiers
        );
    }

}
