/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode } from 'langium';
import { GrammarAST } from 'langium';
import { MultilineCommentHoverProvider } from 'langium/lsp';
import { createRuleDiagramSvg, type GrammarDiagramOptions } from './grammar-railroad.js';

/**
 * Styling for diagrams in the hover, applied on top of the default styling. The hover shows the diagram
 * as an image, which can't follow the editor theme. So it uses a transparent background, mid-grey lines
 * and filled boxes with white text, which stay readable on both light and dark themes.
 * Keywords have rounded boxes (`rx`), rule calls have square ones.
 */
export const hoverCss = `
svg.railroad-diagram {
    background-color: transparent;
}
svg.railroad-diagram path {
    stroke-width: 2;
    stroke: #8f8f8f;
}
svg.railroad-diagram rect {
    stroke-width: 2;
    stroke: #5a5a5a;
    fill: #5a5a5a;
}
svg.railroad-diagram rect[rx] {
    stroke: #3b6ea5;
    fill: #3b6ea5;
}
svg.railroad-diagram text {
    fill: #ffffff;
}
`.trim();

/**
 * Hover provider for Langium grammars that shows the railroad diagram of a parser rule below its
 * documentation comment. Applies to both the rule declaration and references to it.
 *
 * The diagram is embedded as a Markdown image with a base64 data URI. Clients render it as an image,
 * so it can't react to the editor theme and doesn't support links or scripts. Clients that don't
 * support data URIs in hovers only show the documentation.
 *
 * Register it for the grammar language via `createLangiumGrammarServices`:
 * ```ts
 * createLangiumGrammarServices(context, sharedModule, {
 *     lsp: { HoverProvider: (services) => new RailroadHoverProvider(services) }
 * });
 * ```
 */
export class RailroadHoverProvider extends MultilineCommentHoverProvider {

    protected override async getAstNodeHoverContent(node: AstNode): Promise<string | undefined> {
        const documentation = await super.getAstNodeHoverContent(node);
        const diagram = GrammarAST.isParserRule(node) ? this.getDiagramMarkdown(node) : undefined;
        if (documentation && diagram) {
            return `${documentation}\n\n---\n\n${diagram}`;
        }
        return documentation ?? diagram;
    }

    /**
     * Creates the Markdown image of the rule's railroad diagram. Returns `undefined` if the diagram
     * can't be created, so an incomplete grammar never breaks the documentation part of the hover.
     */
    protected getDiagramMarkdown(rule: GrammarAST.ParserRule): string | undefined {
        try {
            const svg = createRuleDiagramSvg(rule, this.getDiagramOptions());
            return `![Railroad diagram of ${rule.name}](data:image/svg+xml;base64,${encodeBase64(svg)})`;
        } catch {
            return undefined;
        }
    }

    /**
     * Options for the diagrams in the hover. By default, diagrams use the theme-neutral {@link hoverCss}.
     */
    protected getDiagramOptions(): GrammarDiagramOptions {
        return { css: hoverCss };
    }
}

/**
 * Encodes the UTF-8 bytes of the given text as base64. `btoa` alone only accepts Latin-1 characters,
 * and `Buffer` isn't available in browsers.
 */
function encodeBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}
