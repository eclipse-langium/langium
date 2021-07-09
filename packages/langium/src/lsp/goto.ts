/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LocationLink, TextDocumentPositionParams } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { findLeafNodeAtOffset, getDocument } from '../utils/ast-util';
import { toRange } from '../utils/cst-util';

export interface GoToResolver {
    goToDefinition(document: LangiumDocument, position: TextDocumentPositionParams): LocationLink[]
}

export class DefaultGoToResolverProvider implements GoToResolver {

    protected readonly nameProvider: NameProvider;
    protected readonly references: References;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.references = services.references.References;
    }

    goToDefinition(document: LangiumDocument, params: TextDocumentPositionParams): LocationLink[] {
        const rootNode = document.parseResult?.value;
        const targetCstNodes: Array<{ source: CstNode, target: CstNode, targetDocument: LangiumDocument }> = [];
        if (rootNode && rootNode.$cstNode) {
            const cst = rootNode.$cstNode;
            const sourceCstNode = findLeafNodeAtOffset(cst, document.offsetAt(params.position));
            if (sourceCstNode) {
                const targetNode = this.references.findDeclaration(sourceCstNode);
                if (targetNode?.element) {
                    const targetDoc = getDocument(targetNode?.element);
                    if (targetNode && targetDoc) {
                        targetCstNodes.push({ source: sourceCstNode, target: targetNode, targetDocument: targetDoc });
                    }
                }
            }
        }
        return targetCstNodes.map(link => LocationLink.create(
            link.targetDocument.uri,
            toRange(this.findActualNodeFor(link.target) ?? link.target, link.targetDocument),
            toRange(link.target, link.targetDocument),
            toRange(link.source, document)
        ));
    }
    protected findActualNodeFor(cstNode: CstNode): CstNode | undefined {
        let actualNode: CstNode | undefined = cstNode;
        while (!actualNode?.element?.$cstNode) {
            if (!actualNode)
                return undefined;
            actualNode = actualNode.parent;
        }
        return actualNode.element.$cstNode;
    }
}
