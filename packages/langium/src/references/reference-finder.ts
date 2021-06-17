/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Location, Position } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { NameProvider } from '../references/naming';
import { LangiumServices } from '../services';
import { CstNode, AstNode } from '../syntax-tree';
import { AstNodeContent, streamAllContents, streamReferences, findLeafNodeAtOffset, AstNodeReference } from '../utils/ast-util';
import { flatten, toRange } from '../utils/cst-util';
import { findNodeForFeature } from '../grammar/grammar-util';
import { GoToResolver } from './goto';

export interface ReferenceFinder {
    findReferences(document: LangiumDocument, position: Position, includeDeclaration: boolean): CstNode[];
    findReferenceLocations(document: LangiumDocument, position: Position, includeDeclaration: boolean): Location[];
}

export class DefaultReferenceFinder implements ReferenceFinder {
    protected readonly nameProvider: NameProvider;
    protected readonly findDeclaration: GoToResolver;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.findDeclaration = services.references.GoToResolver;
    }

    findReferences(document: LangiumDocument, position: Position, includeDeclaration: boolean): CstNode[] {
        const rootNode = document.parseResult?.value?.$cstNode;
        if (!rootNode) {
            return [];
        }
        const refs: CstNode[] = [];
        // TODO use findDeclaration for crossref nodes
        const selectedNode = findLeafNodeAtOffset(rootNode, document.offsetAt(position));
        if(!selectedNode) {
            return [];
        }
        const targetAstNode = this.findDeclaration.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            const process = (node: AstNodeContent) => {
                if (includeDeclaration && node.node === targetAstNode) {
                    const targetName = this.nameProvider.getName(targetAstNode);
                    if (targetName) {
                        const candidateCstNode = this.findNameNode(node.node, targetName);
                        if (candidateCstNode) {
                            refs.push(candidateCstNode);
                        }
                    }
                }
                streamReferences(node.node).forEach((refNode: AstNodeReference) => {
                    if (refNode.reference.ref === targetAstNode) {
                        const refCstNode = findNodeForFeature(refNode.container.$cstNode, refNode.property) ?? refNode.container.$cstNode;
                        if (refCstNode) {
                            refs.push(refCstNode);
                        }
                    }
                });
            };
            streamAllContents(rootNode.element).forEach(process);
        }
        return refs;
    }

    findReferenceLocations(document: LangiumDocument, position: Position, includeDeclaration: boolean): Location[] {
        return this.findReferences(document, position, includeDeclaration).map(node => Location.create(
            document.uri,
            toRange(node, document)
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
