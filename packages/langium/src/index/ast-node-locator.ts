/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument } from '../documents/document';
import { findAssignment, isArray } from '../grammar/grammar-util';
import { AstNode } from '../syntax-tree';

export interface AstNodeLocator {
    /**
     * Creates a path represented by a `string` that identifies an `AstNode` inside its document.
     * It must be possible to retrieve exactly the same `AstNode` from the document using this path.
     * @param node The `AstNode` to create the path for.
     * @returns a path represented by a `string` that identifies `node` inside its document.
     * @see AstNodeLocator.getAstNode
     */
    getAstNodePath(node: AstNode): string;

    /**
     * Locates an `AstNode` inside a document by following the given path.
     * @param document Document to look up
     * @param path Describes how to locate an `AstNode` inside the given `document`.
     * @returns The `AstNode` located under the given path, or `undefined` if the path cannot be resolved.
     * @see AstNodeLocator.getAstNodePath
     */
    getAstNode(document: LangiumDocument, path: string): AstNode | undefined;
}

export class DefaultAstNodeLocator implements AstNodeLocator {
    protected segmentSeparator = '/';

    getAstNodePath(node: AstNode): string {
        let container: AstNode | undefined = node.$container;
        const path: string[] = [];
        while (container) {
            path.push(this.pathSegment(node, container));
            node = container;
            container = container.$container;
        }
        return this.segmentSeparator + path.reverse().join(this.segmentSeparator);
    }

    getAstNode(document: LangiumDocument, path: string): AstNode | undefined {
        const segments = path.split(this.segmentSeparator);
        return segments.reduce((previousValue, currentValue) => {
            if(!previousValue || currentValue.length === 0)
                return previousValue;
            const propertyIndx = currentValue.split('@');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = (previousValue as any)[propertyIndx[0]];
            return (propertyIndx.length === 2) ? value[propertyIndx[1]] : value;
        }, document.parseResult.value);
    }

    protected pathSegment(node: AstNode, container: AstNode): string {
        if (node.$cstNode) {
            const assignment = findAssignment(node.$cstNode);
            if (assignment) {
                if (isArray(assignment.cardinality)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const value = (container as any)[assignment.feature] as AstNode[];
                    const idx = value.indexOf(node);
                    return assignment.feature + '@' + idx;
                }
                return assignment.feature;
            }
        }
        return '<missing>';
    }
}

