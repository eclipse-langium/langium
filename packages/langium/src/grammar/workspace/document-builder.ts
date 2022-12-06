/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumSharedServices } from '../../services';
import { DefaultDocumentBuilder } from '../../workspace/document-builder';
import { DocumentState } from '../../workspace/documents';
import { LangiumGrammarServices } from '../langium-grammar-module';
import { LangiumGrammarDocument } from './documents';

export class LangiumGrammarDocumentBuilder extends DefaultDocumentBuilder {
    constructor(services: LangiumSharedServices) {
        super(services);
        this.addTypeCollectionPhase();
    }

    private addTypeCollectionPhase() {
        super.onBuildPhase(DocumentState.IndexedReferences, async (documents, _cancelToken) => {
            documents.forEach(document => {
                const services = this.serviceRegistry.getServices(document.uri) as LangiumGrammarServices;
                const typeCollector = services.validation.TypeCollector;
                typeCollector.collectValidationResources(super.langiumDocuments, document as LangiumGrammarDocument);
            });
        });
    }
}
