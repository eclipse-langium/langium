/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Location, Range, TextDocumentPositionParams } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { AstNodePathComputer } from '../index/ast-node-locator';
import { IndexManager } from '../index/workspace-index-manager';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode, CstNode } from '../syntax-tree';
import { findAllReferences, findLeafNodeAtOffset, findLocalReferences, getDocument } from '../utils/ast-util';
import { flatten, toRange } from '../utils/cst-util';

export interface ReferenceFinder {
    findReferences(document: LangiumDocument, params: TextDocumentPositionParams, includeDeclaration: boolean): Location[];
}

export class DefaultReferenceFinder implements ReferenceFinder {
    protected readonly nameProvider: NameProvider;
    protected readonly references: References;
    protected readonly index: IndexManager;
    protected readonly nodePath: AstNodePathComputer;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.references = services.references.References;
        this.index = services.index.IndexManager;
        this.nodePath = services.index.AstNodePathComputer;
    }

    findReferences(document: LangiumDocument, params: TextDocumentPositionParams, includeDeclaration: boolean): Location[] {
        const rootNode = document.parseResult?.value?.$cstNode;
        if (!rootNode) {
            return [];
        }
        const refs: Array<{ docUri: string, range: Range }> = [];
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
                    refs.push({ docUri: declDoc.uri, range: toRange(nameNode, declDoc) });
            }
            findLocalReferences(targetAstNode, rootNode.element).forEach((element) => {
                refs.push({ docUri: document.uri, range: toRange(element.$refNode, document) });
            });
            findAllReferences(targetAstNode, this.nodePath.astNodePath(targetAstNode), this.index).forEach((refDescr) => {
                refs.push({ docUri: refDescr.sourceUri, range: Range.create(refDescr.startPosition, refDescr.endPosition) });
            });
        }
        return refs.map(ref => Location.create(
            ref.docUri,
            ref.range
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
