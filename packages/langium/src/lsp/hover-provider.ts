/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Hover, HoverParams } from 'vscode-languageserver';
import type { CancellationToken } from '../utils/cancellation.js';
import type { GrammarConfig } from '../languages/grammar-config.js';
import type { References } from '../references/references.js';
import type { LangiumServices } from './lsp-services.js';
import type { AstNode } from '../syntax-tree.js';
import type { MaybePromise } from '../utils/promise-utils.js';
import type { LangiumDocument } from '../workspace/documents.js';
import type { DocumentationProvider } from '../documentation/documentation-provider.js';
import { findCommentNode, findDeclarationNodeAtOffset } from '../utils/cst-utils.js';
import { isKeyword } from '../languages/generated/ast.js';
import { isJSDoc, parseJSDoc } from '../documentation/jsdoc.js';
import { isAstNodeWithComment } from '../serializer/json-serializer.js';

/**
 * Language-specific service for handling hover requests.
 */
export interface HoverProvider {
    /**
     * Handle a hover request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    getHoverContent(document: LangiumDocument, params: HoverParams, cancelToken?: CancellationToken): MaybePromise<Hover | undefined>;
}

export abstract class AstNodeHoverProvider implements HoverProvider {

    protected readonly references: References;
    protected readonly grammarConfig: GrammarConfig;

    constructor(services: LangiumServices) {
        this.references = services.references.References;
        this.grammarConfig = services.parser.GrammarConfig;
    }

    getHoverContent(document: LangiumDocument, params: HoverParams): MaybePromise<Hover | undefined> {
        const rootNode = document.parseResult?.value?.$cstNode;
        if (rootNode) {
            const offset = document.textDocument.offsetAt(params.position);
            const cstNode = findDeclarationNodeAtOffset(rootNode, offset, this.grammarConfig.nameRegexp);
            if (cstNode && cstNode.offset + cstNode.length > offset) {
                const targetNode = this.references.findDeclaration(cstNode);
                if (targetNode) {
                    return this.getAstNodeHoverContent(targetNode);
                }

                // Add support for documentation on keywords
                if (isKeyword(cstNode.grammarSource)) {
                    return this.getKeywordHoverContent(cstNode.grammarSource);
                }
            }
        }
        return undefined;
    }

    protected abstract getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined>;

    protected getKeywordHoverContent(node: AstNode): MaybePromise<Hover | undefined> {
        let comment = isAstNodeWithComment(node) ? node.$comment : undefined;
        if (!comment) {
            comment = findCommentNode(node.$cstNode, ['ML_COMMENT'])?.text;
        }
        if (comment && isJSDoc(comment)) {
            const content = parseJSDoc(comment).toMarkdown();
            if (content) {
                return {
                    contents: {
                        kind: 'markdown',
                        value: content
                    }
                };
            }
        }
        return undefined;
    }
}

export class MultilineCommentHoverProvider extends AstNodeHoverProvider {

    protected readonly documentationProvider: DocumentationProvider;

    constructor(services: LangiumServices) {
        super(services);
        this.documentationProvider = services.documentation.DocumentationProvider;
    }

    protected getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined> {
        const content = this.documentationProvider.getDocumentation(node);

        if (content) {
            return {
                contents: {
                    kind: 'markdown',
                    value: content
                }
            };
        }
        return undefined;
    }
}
