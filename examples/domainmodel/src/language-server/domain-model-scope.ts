/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNodeDescription, DocumentSymbols, LangiumDocument } from 'langium';
import type { DomainModelServices } from './domain-model-module.js';
import type { QualifiedNameProvider } from './domain-model-naming.js';
import type { Domainmodel, PackageDeclaration } from './generated/ast.js';
import { AstUtils, Cancellation, DefaultScopeComputation, interruptAndCheck } from 'langium';
import { isType, isPackageDeclaration } from './generated/ast.js';

export class DomainModelScopeComputation extends DefaultScopeComputation {

    qualifiedNameProvider: QualifiedNameProvider;

    constructor(services: DomainModelServices) {
        super(services);
        this.qualifiedNameProvider = services.references.QualifiedNameProvider;
    }

    /**
     * Exports only types (`DataType or `Entity`) with their qualified names.
     */
    override async computeExports(document: LangiumDocument, cancelToken = Cancellation.CancellationToken.None): Promise<AstNodeDescription[]> {
        const descr: AstNodeDescription[] = [];
        for (const modelNode of AstUtils.streamAllContents(document.parseResult.value)) {
            await interruptAndCheck(cancelToken);
            if (isType(modelNode)) {
                let name = this.nameProvider.getName(modelNode);
                if (name) {
                    if (isPackageDeclaration(modelNode.$container)) {
                        name = this.qualifiedNameProvider.getQualifiedName(modelNode.$container as PackageDeclaration, name);
                    }
                    descr.push(this.descriptions.createDescription(modelNode, name, document));
                }
            }
        }
        return descr;
    }

    override async computeLocalSymbols(document: LangiumDocument<Domainmodel>, cancelToken = Cancellation.CancellationToken.None): Promise<DocumentSymbols> {
        const model = document.parseResult.value;
        const documentSymbols = this.newDocumentSymbols(document);
        await this.processContainer(model, documentSymbols, document, cancelToken);
        return documentSymbols;
    }

    protected async processContainer(container: Domainmodel | PackageDeclaration, documentSymbols: DocumentSymbols, document: LangiumDocument, cancelToken: Cancellation.CancellationToken): Promise<AstNodeDescription[]> {
        const localDescriptions: AstNodeDescription[] = [];
        for (const element of container.elements) {
            await interruptAndCheck(cancelToken);
            if (isType(element) && element.name) {
                const description = this.descriptions.createDescription(element, element.name, document);
                localDescriptions.push(description);
            } else if (isPackageDeclaration(element)) {
                const nestedDescriptions = await this.processContainer(element, documentSymbols, document, cancelToken);
                for (const description of nestedDescriptions) {
                    // Add qualified names to the container
                    const qualified = this.createQualifiedDescription(element, description, document);
                    localDescriptions.push(qualified);
                }
            }
        }
        documentSymbols.addAll(container, localDescriptions);
        return localDescriptions;
    }

    protected createQualifiedDescription(pack: PackageDeclaration, description: AstNodeDescription, document: LangiumDocument): AstNodeDescription {
        const name = this.qualifiedNameProvider.getQualifiedName(pack.name, description.name);
        return this.descriptions.createDescription(description.node!, name, document);
    }

}
