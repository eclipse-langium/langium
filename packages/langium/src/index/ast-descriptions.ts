/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument } from '../documents/document';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { streamContents } from '../utils/ast-util';

export interface AstNodeReferenceDescription {
    sourcePath: string
    targetPath: string
}

export interface AstNodeDescriptionProvider {
    createDescription(node: AstNode, name: string, document: LangiumDocument): AstNodeDescription;
    createDescriptions(document: LangiumDocument): AstNodeDescription[];
}

export interface AstReferenceDescriptionProvider {
    createDescriptions(document: LangiumDocument): AstNodeReferenceDescription[];
}

export class DefaultDescriptionsProvider implements AstNodeDescriptionProvider {

    protected readonly services: LangiumServices;

    constructor(services: LangiumServices) { this.services = services; }

    createDescription(node: AstNode, name: string, document: LangiumDocument): AstNodeDescription {
        return {
            node,
            name,
            type: node.$type,
            documentUri: document.uri,
            path: this.services.index.AstNodePathComputer.astNodePath(node)
        };
    }

    createDescriptions(document: LangiumDocument): AstNodeDescription[] {
        const descr: AstNodeDescription[] = [];
        const rooNode = document.parseResult?.value;
        if (rooNode) {
            const name = this.services.references.NameProvider.getName(rooNode);
            if (name) {
                descr.push(this.createDescription(rooNode, name, document));
            }
            streamContents(rooNode).forEach(content => {
                const name = this.services.references.NameProvider.getName(content.node);
                if (name) {
                    descr.push(this.createDescription(content.node, name, document));
                }
            });
        }
        return descr;
    }

}

