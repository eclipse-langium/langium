/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Location, Range } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { isAssignment } from '../grammar/generated/ast';
import { findLeafNodeAtOffset, findNodeForFeature } from '../grammar/grammar-util';
import { LangiumServices } from '../services';
import { Reference } from '../syntax-tree';
import { getContainerOfType, isReference } from '../utils/ast-util';
import { NameProvider } from './naming';

export interface GoToResolver {
    goToDeclaration(document: LangiumDocument, offset: number): Location[]
}

export class DefaultGoToResolverProvider implements GoToResolver {

    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    goToDeclaration(document: LangiumDocument, offset: number): Location[] {
        const rootNode = document.parseResult?.value;
        const locations: Location[] = [];
        if (rootNode && rootNode.$cstNode) {
            const cst = rootNode.$cstNode;
            const node = findLeafNodeAtOffset(cst, offset);

            const assignment = getContainerOfType(node?.feature, isAssignment);
            const nodeElem = node?.element as unknown as Record<string, Reference>;
            if (assignment && nodeElem) {

                if (isReference(nodeElem[assignment.feature])) {
                    const ref = nodeElem[assignment.feature].ref;
                    if (ref) {
                        const targetCst = ref.$cstNode;

                        if (targetCst) {
                            let targetNode = findNodeForFeature(targetCst, 'name');
                            if (!targetNode) targetNode = targetCst;
                            const posA = targetNode.offset;
                            const posB = targetNode.offset + targetNode.length;
                            locations.push(Location.create(document.uri, Range.create(document.positionAt(posA), document.positionAt(posB))));
                        }
                    }
                }
            }

        }
        return locations;
    }

}
