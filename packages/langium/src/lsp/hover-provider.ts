/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Hover, HoverParams } from 'vscode-languageserver';
import { GrammarConfig } from '../grammar/grammar-config';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription, isLeafCstNode } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { findCommentNode, findDeclarationNodeAtOffset } from '../utils/cst-util';
import { isJSDoc, parseJSDoc } from '../utils/jsdoc-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';
import { IndexManager } from '../workspace/index-manager';

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
            }
        }
        return undefined;
    }

    protected abstract getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined>;

}

export class MultilineCommentHoverProvider extends AstNodeHoverProvider {

    protected readonly indexManager: IndexManager;

    constructor(services: LangiumServices) {
        super(services);
        this.indexManager = services.shared.workspace.IndexManager;
    }

    protected getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined> {
        const lastNode = findCommentNode(node.$cstNode, this.grammarConfig.multilineCommentRules);
        let content = '';
        if (isLeafCstNode(lastNode) && isJSDoc(lastNode)) {
            const parsedJSDoc = parseJSDoc(lastNode);
            content = parsedJSDoc.toMarkdown({
                renderLink: (link, display) => {
                    return this.hoverLinkRenderer(node, link, display);
                }
            });
        }

        const additionalContent = this.getAdditionalHoverContent(node);

        if (additionalContent && additionalContent.length > 0) {
            content = additionalContent + '\n\n---\n\n' + content;
        }

        if (content.length > 0) {
            return {
                contents: {
                    kind: 'markdown',
                    value: content
                }
            };
        }
        return undefined;
    }

    protected getAdditionalHoverContent(_node: AstNode): string | undefined {
        return undefined;
    }

    protected hoverLinkRenderer(node: AstNode, name: string, display: string): string | undefined {
        const description = this.findNameInPrecomputedScopes(node, name) ?? this.findNameInGlobalScope(node, name);
        if (description && description.segment) {
            const line = description.segment.range.start.line + 1;
            const character = description.segment.range.start.character + 1;
            const uri = description.documentUri.with({ fragment: `L${line},${character}` });
            return `[${display}](${uri.toString()})`;
        } else {
            return undefined;
        }
    }

    protected findNameInPrecomputedScopes(node: AstNode, name: string): AstNodeDescription | undefined {
        const document = getDocument(node);
        const precomputed = document.precomputedScopes;
        if (!precomputed) {
            return undefined;
        }
        let currentNode: AstNode | undefined = node;
        do {
            const allDescriptions = precomputed.get(currentNode);
            const description = allDescriptions.find(e => e.name === name);
            if (description) {
                return description;
            }
            currentNode = currentNode.$container;
        } while (currentNode);

        return undefined;
    }

    protected findNameInGlobalScope(node: AstNode, name: string): AstNodeDescription | undefined {
        const description = this.indexManager.allElements().find(e => e.name === name);
        return description;
    }
}
