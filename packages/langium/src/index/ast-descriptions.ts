/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Range } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNode, CstNode } from '../syntax-tree';
import { AstNodeReference, getDocument, streamAllContents, streamContents, streamReferences } from '../utils/ast-util';

export interface AstNodeReferenceDescription {
    sourceUri: string // URI of the document that holds a reference
    sourcePath: string // Path to AstNode that holds a reference
    targetUri: string // target document uri
    targetPath: string // how to find target AstNode inside the document
    startPosition: { line: number, character: number } // Text document position start
    endPosition: { line: number, character: number } //  Text document position end
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

export class DefaultReferenceDescriptionProvider implements AstReferenceDescriptionProvider {

    protected readonly services: LangiumServices;

    constructor(services: LangiumServices) { this.services = services; }

    createDescriptions(document: LangiumDocument): AstNodeReferenceDescription[] {
        const descr: AstNodeReferenceDescription[] = [];
        const rootNode = document.parseResult?.value;
        if (rootNode) {
            const refConverter = (refNode: AstNodeReference) => {
                const refAstNodeDescr = this.services.references.Linker.linkingCandiates(refNode.container, refNode.reference.$refName, `${refNode.container.$type}:${refNode.property}`);
                // Do not handle unresolved refs or local references
                const docUri = getDocument(refNode.container)?.uri;
                if (!refAstNodeDescr || refAstNodeDescr.documentUri === docUri)
                    return null;
                const range = toRange(refNode.reference.$refNode, document);
                return {
                    sourceUri: docUri,
                    sourcePath: this.services.index.AstNodePathComputer.astNodePath(refNode.container),
                    sourceFeature: refNode.property,
                    targetUri: refAstNodeDescr.documentUri,
                    targetPath: refAstNodeDescr.path,
                    startPosition: { line: range.start.line, character: range.start.character },
                    endPosition: { line: range.end.line, character: range.end.character }
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
// Can't import from cst-util: getting TypeError
function toRange(node: CstNode, document: LangiumDocument): Range {
    return {
        start: document.positionAt(node.offset),
        end: document.positionAt(node.offset + node.length)
    };
}
