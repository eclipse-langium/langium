/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefaultWorkspaceManager, URI, type LangiumDocument, type LangiumDocumentFactory, type WorkspaceFolder } from 'langium';
import type { LangiumSharedServices } from 'langium/lsp';

export class DomainModelWorkspaceManager extends DefaultWorkspaceManager {

    private readonly documentFactory: LangiumDocumentFactory;

    constructor(services: LangiumSharedServices) {
        super(services);
        this.documentFactory = services.workspace.LangiumDocumentFactory;
    }

    protected override async loadAdditionalDocuments(_folders: WorkspaceFolder[], collector: (document: LangiumDocument) => void): Promise<void> {
        const document = this.documentFactory.fromString(
            'datatype Int',
            URI.parse('domain-model://domainmodel/Int.dmodel')
        );
        collector(document);
    }
}
