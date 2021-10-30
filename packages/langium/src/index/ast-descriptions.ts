/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DocumentSegment, LangiumDocument } from '../documents/document';
import { Linker, getReferenceId } from '../references/linker';
import { NameProvider } from '../references/naming';
import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription, ReferenceInfo } from '../syntax-tree';
import { getDocument, isLinkingError, streamAllContents, streamContents, streamReferences } from '../utils/ast-util';
import { toDocumentSegment } from '../utils/cst-util';
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
        const refConverter = (refInfo: ReferenceInfo): ReferenceDescription | undefined => {
            const refAstNodeDescr = this.linker.getCandidate(refInfo.container, getReferenceId(refInfo.container.$type, refInfo.property), refInfo.reference);
            // Do not handle unresolved refs
            if (isLinkingError(refAstNodeDescr))
                return undefined;
            const doc = getDocument(refInfo.container);
            const docUri = doc.uri;
            const refCstNode = refInfo.reference.$refNode;
            return {
                sourceUri: docUri,
                sourcePath: this.nodeLocator.getAstNodePath(refInfo.container),
                targetUri: refAstNodeDescr.documentUri,
                targetPath: refAstNodeDescr.path,
                segment: toDocumentSegment(refCstNode),
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
