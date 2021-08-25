/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Range } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { AstNode, CstNode, LeafCstNode } from '../syntax-tree';
import { CompositeCstNodeImpl, LeafCstNodeImpl } from '../parser/cst-node-builder';
import { DatatypeSymbol } from '../parser/langium-parser';

export function flatten(node: CstNode): LeafCstNode[] {
    if (node instanceof LeafCstNodeImpl) {
        return [node];
    } else if (node instanceof CompositeCstNodeImpl) {
        return node.children.flatMap(e => flatten(e));
    } else {
        return [];
    }
}

export function toRange(node: CstNode, document: LangiumDocument): Range {
    return {
        start: document.positionAt(node.offset),
        end: document.positionAt(node.offset + node.length)
    };
}

export function findRelevantNode(cstNode: CstNode): AstNode | undefined {
    let n: CstNode | undefined = cstNode;
    do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = n.element as any;
        if (element.$type !== DatatypeSymbol) {
            return element;
        }
        n = n.parent;
    } while (n);
    return undefined;
}
