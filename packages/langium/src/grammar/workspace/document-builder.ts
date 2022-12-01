/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefaultDocumentBuilder } from '../../workspace/document-builder';
import { DocumentState } from '../../workspace/documents';
import { Grammar } from '../generated/ast';
import { LangiumGrammarSharedServices } from '../langium-grammar-module';
import { LangiumGrammarTypeCollector } from './type-collector';

export class LangiumGrammarDocumentBuilder extends DefaultDocumentBuilder {
    protected readonly typeCollector: LangiumGrammarTypeCollector;

    constructor(services: LangiumGrammarSharedServices) {
        super(services);
        this.typeCollector = services.workspace.TypeCollector;
        this.addTypeCollectionPhase();
    }

    private addTypeCollectionPhase() {
        super.onBuildPhase(DocumentState.IndexedReferences, async (documents, _cancelToken) => {
            const grammars = documents.map(doc => doc.parseResult.value as Grammar);
            this.typeCollector.collectValidationResources(super.langiumDocuments, grammars);
        });
    }
}
