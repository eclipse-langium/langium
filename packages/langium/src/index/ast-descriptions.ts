/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument } from '../documents/document';
import { Linker } from '../references/linker';
import { NameProvider } from '../references/naming';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { AstNodeReference, getDocument, streamAllContents, streamContents, streamReferences } from '../utils/ast-util';
import { AstNodeLocator } from './ast-node-locator';

export interface ReferenceDescription {
    sourceUri: string // URI of the document that holds a reference
    sourcePath: string // Path to AstNode that holds a reference
    targetUri: string // target document uri
    targetPath: string // how to find target AstNode inside the document
    start: number
    end: number
}

export interface AstNodeDescriptionProvider {
    createDescription(node: AstNode, name: string, document: LangiumDocument): AstNodeDescription;
    createDescriptions(document: LangiumDocument): AstNodeDescription[];
}

export interface ReferenceDescriptionProvider {
    createDescriptions(document: LangiumDocument): ReferenceDescription[];
}

export class DefaultAstNodeDescriptionProvider implements AstNodeDescriptionProvider {

    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.astNodeLocator = services.index.AstNodeLocator;
        this.nameProvider = services.references.NameProvider;
    }

    createDescription(node: AstNode, name: string, document: LangiumDocument): AstNodeDescription {
        return {
            node,
            name,
            type: node.$type,
            documentUri: document.textDocument.uri,
            path: this.astNodeLocator.getAstNodePath(node)
        };
    }

    createDescriptions(document: LangiumDocument): AstNodeDescription[] {
        const descr: AstNodeDescription[] = [];
        const rooNode = document.parseResult.value;
        if (rooNode) {
            const name = this.nameProvider.getName(rooNode);
            if (name) {
                descr.push(this.createDescription(rooNode, name, document));
            }
            streamContents(rooNode).forEach(content => {
                const name = this.nameProvider.getName(content.node);
                if (name) {
                    descr.push(this.createDescription(content.node, name, document));
                }
            });
        }
        return descr;
    }
}

export class DefaultReferenceDescriptionProvider implements ReferenceDescriptionProvider {

    protected readonly linker: Linker;
    protected readonly nodeLocator: AstNodeLocator;

    constructor(services: LangiumServices) {
        this.linker = services.references.Linker;
        this.nodeLocator = services.index.AstNodeLocator;
    }

    createDescriptions(document: LangiumDocument): ReferenceDescription[] {
        const descr: ReferenceDescription[] = [];
        const rootNode = document.parseResult.value;
        if (rootNode) {
            const refConverter = (refNode: AstNodeReference): ReferenceDescription | undefined => {
                const refAstNodeDescr = this.linker.getCandidate(refNode.container, refNode.reference.$refName, `${refNode.container.$type}:${refNode.property}`);
                // Do not handle unresolved refs or local references
                const docUri = getDocument(refNode.container)?.textDocument?.uri;
                if (!refAstNodeDescr || refAstNodeDescr.documentUri === docUri)
                    return undefined;
                return {
                    sourceUri: docUri,
                    sourcePath: this.nodeLocator.getAstNodePath(refNode.container),
                    targetUri: refAstNodeDescr.documentUri,
                    targetPath: refAstNodeDescr.path,
                    start: refNode.reference.$refNode.offset,
                    end: refNode.reference.$refNode.offset + refNode.reference.$refNode.length
                };
            };
            streamAllContents(rootNode).forEach(astNodeContent => {
                const astNode = astNodeContent.node;
                streamReferences(astNode).forEach(ref => {
                    const refDescr = refConverter(ref);
                    if (refDescr)
                        descr.push(refDescr);
                });
            });
        }
        return descr;
    }
}