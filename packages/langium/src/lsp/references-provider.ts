/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Location,  ReferenceParams } from 'vscode-languageserver';
import { NameProvider } from '../references/name-provider';
import { References } from '../references/references';
import { LeafCstNode } from '../syntax-tree';
import { LangiumServices } from '../services';
import { findDeclarationNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';
import { GrammarConfig } from '../grammar/grammar-config';

/**
 * Language-specific service for handling find references requests.
 */
export interface ReferencesProvider {
    /**
     * Handle a find references request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    findReferences(document: LangiumDocument, params: ReferenceParams, cancelToken?: CancellationToken): MaybePromise<Location[]>;
}

export class DefaultReferencesProvider implements ReferencesProvider {
    protected readonly nameProvider: NameProvider;
    protected readonly references: References;
    protected readonly grammarConfig: GrammarConfig;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.references = services.references.References;
        this.grammarConfig = services.parser.GrammarConfig;
    }

    findReferences(document: LangiumDocument, params: ReferenceParams): MaybePromise<Location[]> {
        const rootNode = document.parseResult.value.$cstNode;
        if (!rootNode) {
            return [];
        }

        const selectedNode = findDeclarationNodeAtOffset(rootNode, document.textDocument.offsetAt(params.position), this.grammarConfig.nameRegexp);
        if (!selectedNode) {
            return [];
        }

        return this.getReferences(selectedNode, params, document);
    }

    protected getReferences(selectedNode: LeafCstNode, params: ReferenceParams, _document: LangiumDocument): Location[] {
        const locations: Location[] = [];
        const targetAstNode = this.references.findDeclaration(selectedNode);
        if (targetAstNode) {
            const options = { includeDeclaration: params.context.includeDeclaration };
            this.references.findReferences(targetAstNode, options).forEach(reference => {
                locations.push(Location.create(reference.sourceUri.toString(), reference.segment.range));
            });
        }
        return locations;
    }
}
