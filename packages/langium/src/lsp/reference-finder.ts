/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Location, TextDocumentPositionParams } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode, CstNode } from '../syntax-tree';
import { findLeafNodeAtOffset, findLocalReferences, getDocument } from '../utils/ast-util';
import { flatten, toRange } from '../utils/cst-util';

export interface ReferenceFinder {
    findReferences(document: LangiumDocument, params: TextDocumentPositionParams, includeDeclaration: boolean): Location[];
}

export class DefaultReferenceFinder implements ReferenceFinder {
    protected readonly nameProvider: NameProvider;
    protected readonly references: References;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.references = services.references.References;
    }

    findReferences(document: LangiumDocument, params: TextDocumentPositionParams, includeDeclaration: boolean): Location[] {
        const rootNode = document.parseResult?.value?.$cstNode;
        if (!rootNode) {
            return [];
        }
        const refs: Array<{ doc: LangiumDocument, node: CstNode }> = [];
        const selectedNode = findLeafNodeAtOffset(rootNode, document.offsetAt(params.position));
        if (!selectedNode) {
            return [];
        }
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            if (includeDeclaration) {
                const declDoc = getDocument(targetAstNode);
                const nameNode = this.findNameNode(targetAstNode, selectedNode.text);
                if (nameNode)
                    refs.push({ doc: declDoc, node: nameNode });
            }
            findLocalReferences(targetAstNode, rootNode.element).forEach((element) => {
                refs.push({ doc: document, node: element.$refNode });
            });
        }
        return refs.map(ref => Location.create(
            ref.doc.uri,
            toRange(ref.node, ref.doc)
        ));
    }

    protected findNameNode(node: AstNode, name: string): CstNode | undefined {
        const nameNode = this.nameProvider.getNameNode(node);
        if (nameNode)
            return nameNode;
        if (node.$cstNode) {
            // try find first leaf with name as text
            const leafNode = flatten(node.$cstNode).find((n) => n.text === name);
            if (leafNode)
                return leafNode;
        }
        return node.$cstNode;
    }
}
