/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI } from 'vscode-uri';
import { CancellationToken } from 'vscode-languageserver';
import { AstNode, LangiumDocument, LangiumDocuments, LangiumServices } from 'langium';
import { GeneratorArguments, IDiagramGenerator, SModelRoot } from 'sprotty-protocol';

export interface LangiumDiagramGeneratorArguments extends GeneratorArguments {
    document?: LangiumDocument;
    cancelToken?: CancellationToken;
    idCache?: IdCache;
}

export interface GeneratorContext<T extends AstNode = AstNode> extends LangiumDiagramGeneratorArguments {
    document: LangiumDocument<T>;
    cancelToken: CancellationToken;
    idCache: IdCache;
}

export abstract class LangiumDiagramGenerator implements IDiagramGenerator {

    protected readonly langiumDocuments: LangiumDocuments;

    constructor(services: LangiumServices) {
        this.langiumDocuments = services.documents.LangiumDocuments;
    }

    generate(args: LangiumDiagramGeneratorArguments): SModelRoot | Promise<SModelRoot> {
        if (!args.document) {
            const sourceUri = args.options.sourceUri as string;
            if (!sourceUri) {
                return Promise.reject("Missing 'sourceUri' option in request.");
            }
            args.document = this.langiumDocuments.getOrCreateDocument(URI.parse(sourceUri));
        }
        if (!args.cancelToken) {
            args.cancelToken = CancellationToken.None;
        }
        if (!args.idCache) {
            args.idCache = new IdCache();
        }
        return this.generateRoot(args as GeneratorContext);
    }

    protected abstract generateRoot(args: GeneratorContext): SModelRoot | Promise<SModelRoot>;

}

/**
 * Generate unique IDs for model elements.
 *
 * In Sprotty, it's the diagram implementor's responsibility to create unique IDs for SModel elements.
 * For consistent animations on model updates, these IDs should be based on properties of the
 * underlying model in a way that they are resilient to reordering.
 *
 * This class makes sure these IDs are unique, and allows to look them up for a given model element in
 * order to establish cross references in the SModel, e.g. for `sourceId` and `targetId` of an SEdge.
 */
export class IdCache<T = AstNode> {

    protected readonly id2element: Map<string, T> = new Map();
    protected readonly element2id: Map<T, string> = new Map();
    protected readonly otherIds: Set<string> = new Set();

    isIdAlreadyUsed(id: string): boolean {
        return this.id2element.has(id) || this.otherIds.has(id);
    }

    uniqueId(idProposal: string, element?: T): string {
        let proposedId = idProposal;
        let count = 0;
        do {
            proposedId = count === 0 ? idProposal : idProposal + count;
            if (element && this.id2element.get(proposedId) === element) {
                return proposedId;
            }
            count++;
        } while (this.isIdAlreadyUsed(proposedId));
        if (element) {
            this.id2element.set(proposedId, element);
            this.element2id.set(element, proposedId);
        } else {
            this.otherIds.add(proposedId);
        }
        return proposedId;
    }

    getId(element: T | undefined): string | undefined {
        if (!element) {
            return undefined;
        }
        return this.element2id.get(element);
    }

}
