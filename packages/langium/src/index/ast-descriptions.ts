/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DocumentSegment, LangiumDocument, toDocumentSegment } from '../documents/document';
import { Linker } from '../references/linker';
import { NameProvider } from '../references/naming';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { AstNodeReference, getDocument, streamAllContents, streamContents, streamReferences } from '../utils/ast-util';
import { interruptAndCheck } from '../utils/promise-util';
import { AstNodeLocator } from './ast-node-locator';

export interface ReferenceDescription {
    /** URI of the document that holds a reference */
    sourceUri: URI
    /** Path to AstNode that holds a reference */
    sourcePath: string
    /** Target document uri */
    targetUri: URI
    /** Path to the target AstNode inside the document */
    targetPath: string
    /** Segment of the reference text. */
    segment: DocumentSegment
    /** Marks a local reference i.e. a cross reference inside a document.   */
    local?: boolean
}

export interface AstNodeDescriptionProvider {
    createDescription(node: AstNode, name: string, document: LangiumDocument, cancelToken?: CancellationToken): AstNodeDescription;
    createDescriptions(document: LangiumDocument, cancelToken?: CancellationToken): Promise<AstNodeDescription[]>;
}

export interface ReferenceDescriptionProvider {
    createDescriptions(document: LangiumDocument, cancelToken?: CancellationToken): Promise<ReferenceDescription[]>;
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
            documentUri: document.uri,
            path: this.astNodeLocator.getAstNodePath(node)
        };
    }

    async createDescriptions(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<AstNodeDescription[]> {
        const descr: AstNodeDescription[] = [];
        const rootNode = document.parseResult.value;
        const name = this.nameProvider.getName(rootNode);
        if (name) {
            descr.push(this.createDescription(rootNode, name, document));
        }
        for (const content of streamContents(rootNode)) {
            await interruptAndCheck(cancelToken);
            const name = this.nameProvider.getName(content.node);
            if (name) {
                descr.push(this.createDescription(content.node, name, document));
            }
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

    async createDescriptions(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<ReferenceDescription[]> {
        const descr: ReferenceDescription[] = [];
        const rootNode = document.parseResult.value;
        const refConverter = (refNode: AstNodeReference): ReferenceDescription | undefined => {
            const refAstNodeDescr = this.linker.getCandidate(refNode.container, refNode.reference.$refName, `${refNode.container.$type}:${refNode.property}`);
            // Do not handle unresolved refs
            if (!refAstNodeDescr)
                return undefined;
            const doc = getDocument(refNode.container);
            const docUri = doc.uri;
            const refNodeRange = refNode.reference.$refNode.range;
            return {
                sourceUri: docUri,
                sourcePath: this.nodeLocator.getAstNodePath(refNode.container),
                targetUri: refAstNodeDescr.documentUri,
                targetPath: refAstNodeDescr.path,
                segment: toDocumentSegment(doc.textDocument, refNodeRange.start, refNodeRange.end),
                local: refAstNodeDescr.documentUri.toString() === docUri.toString()
            };
        };
        for (const astNodeContent of streamAllContents(rootNode)) {
            await interruptAndCheck(cancelToken);
            const astNode = astNodeContent.node;
            streamReferences(astNode).forEach(ref => {
                const refDescr = refConverter(ref);
                if (refDescr)
                    descr.push(refDescr);
            });
        }
        return descr;
    }
}
