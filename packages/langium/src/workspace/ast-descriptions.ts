/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { NameProvider } from '../references/naming';
import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription, ReferenceInfo } from '../syntax-tree';
import { getDocument, isLinkingError, streamAllContents, streamContents, streamReferences } from '../utils/ast-util';
import { toDocumentSegment } from '../utils/cst-util';
import { interruptAndCheck } from '../utils/promise-util';
import { AstNodeLocator } from './ast-node-locator';
import { DocumentSegment, LangiumDocument } from './documents';

/**
 * Creates descriptions of AST nodes to be used for cross-reference resolutions.
 */
export interface AstNodeDescriptionProvider {

    /**
     * Create a description for the given AST node. This service method is typically used while indexing
     * the contents of a document and during scope precomputation.
     *
     * @param node An AST node.
     * @param name The name to be used to refer to the AST node. Typically this is determined by the
     *     `NameProvider` service, but alternative names may be provided according to the semantics
     *     of your language.
     * @param document The document containing the AST node. If omitted, it is taken from the root AST node.
     */
    createDescription(node: AstNode, name: string, document?: LangiumDocument): AstNodeDescription;

    /**
     * Create descriptions of all AST nodes that shall be exported from the given document. These descriptions
     * are gathered by the `IndexManager` and stored in the global index so they can be referenced from other
     * documents.
     *
     * _Note:_ You should not resolve any cross-references in this service method. Cross-reference resolution
     * depends on the preprocessing phase to be completed, which runs after the initial indexing where this
     * method is used.
     *
     * @param document The document in which to gather exported AST nodes.
     * @param cancelToken Indicates when to cancel the current operation.
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    createDescriptions(document: LangiumDocument, cancelToken?: CancellationToken): Promise<AstNodeDescription[]>;
}

export class DefaultAstNodeDescriptionProvider implements AstNodeDescriptionProvider {

    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.astNodeLocator = services.index.AstNodeLocator;
        this.nameProvider = services.references.NameProvider;
    }

    createDescription(node: AstNode, name: string, document: LangiumDocument = getDocument(node)): AstNodeDescription {
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
        for (const node of streamContents(rootNode)) {
            await interruptAndCheck(cancelToken);
            const name = this.nameProvider.getName(node);
            if (name) {
                descr.push(this.createDescription(node, name, document));
            }
        }
        return descr;
    }
}

/**
 * Describes a cross-reference within a document or between two documents.
 */
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

/**
 * Creates descriptions of all cross-references in a document. These are used by the `IndexManager`
 * to determine which documents are affected and should be rebuilt when a document is changed.
 */
export interface ReferenceDescriptionProvider {
    /**
     * Create descriptions of all cross-references found in the given document. These descriptions are
     * gathered by the `IndexManager` and stored in the global index so they can be considered when
     * a document change is reported by the client.
     *
     * @param document The document in which to gather cross-references.
     * @param cancelToken Indicates when to cancel the current operation.
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    createDescriptions(document: LangiumDocument, cancelToken?: CancellationToken): Promise<ReferenceDescription[]>;
}

export class DefaultReferenceDescriptionProvider implements ReferenceDescriptionProvider {

    protected readonly nodeLocator: AstNodeLocator;

    constructor(services: LangiumServices) {
        this.nodeLocator = services.index.AstNodeLocator;
    }

    async createDescriptions(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<ReferenceDescription[]> {
        const descr: ReferenceDescription[] = [];
        const rootNode = document.parseResult.value;
        const refConverter = (refInfo: ReferenceInfo): ReferenceDescription | undefined => {
            const refAstNodeDescr = refInfo.reference.$nodeDescription;
            // Do not handle not yet linked references. Consider logging a warning or throw an exception when DocumentState is < than Linked
            if (!refAstNodeDescr) {
                return undefined;
            }
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
        for (const astNode of streamAllContents(rootNode)) {
            await interruptAndCheck(cancelToken);
            streamReferences(astNode).filter(refInfo => !isLinkingError(refInfo)).forEach(refInfo => {
                const refDescr = refConverter(refInfo);
                if (refDescr) {
                    descr.push(refDescr);
                }
            });
        }
        return descr;
    }
}
