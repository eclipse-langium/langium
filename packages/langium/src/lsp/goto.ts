/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Location, Range, TextDocumentPositionParams } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { findLeafNodeAtOffset } from '../utils/ast-util';

export interface GoToResolver {
    goToDeclaration(document: LangiumDocument, position: TextDocumentPositionParams): Location[]
}

export class DefaultGoToResolverProvider implements GoToResolver {

    protected readonly nameProvider: NameProvider;
    protected readonly references: References;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.references = services.references.References;
    }

    goToDeclaration(document: LangiumDocument, params: TextDocumentPositionParams): Location[] {
        const rootNode = document.parseResult?.value;
        const targetCstNodes: CstNode[] = [];
        if (rootNode && rootNode.$cstNode) {
            const cst = rootNode.$cstNode;
            const sourceCstNode = findLeafNodeAtOffset(cst, document.offsetAt(params.position));
            if (sourceCstNode) {
                const targetNode = this.references.findDeclaration(sourceCstNode);
                if (targetNode) {
                    targetCstNodes.push(targetNode);
                }
            }
        }
        return targetCstNodes.map(node => {
            const offset = document.positionAt(node.offset);
            return Location.create(
                document.uri,
                Range.create(offset, offset));
        }
        );
    }

}
