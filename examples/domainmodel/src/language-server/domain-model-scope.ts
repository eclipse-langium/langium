/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNodeDescription, DefaultScopeComputation, interruptAndCheck, LangiumDocument, LangiumServices, PrecomputedScopes } from 'langium';
import { CancellationToken } from 'vscode-jsonrpc';
import { DomainModelNameProvider } from './domain-model-naming';
import { Domainmodel, isType, PackageDeclaration, isPackageDeclaration } from './generated/ast';

export class DomainModelScopeComputation extends DefaultScopeComputation {

    constructor(services: LangiumServices) {
        super(services);
    }

    async computeScope(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<PrecomputedScopes> {
        const model = document.parseResult.value as Domainmodel;
        const scopes = new Map();
        await this.processContainer(model, scopes, document, cancelToken);
        return scopes;
    }

    protected async processContainer(container: Domainmodel | PackageDeclaration, scopes: PrecomputedScopes, document: LangiumDocument, cancelToken: CancellationToken): Promise<AstNodeDescription[]> {
        const localDescriptions: AstNodeDescription[] = [];
        for (const element of container.elements) {
            interruptAndCheck(cancelToken);
            if (isType(element)) {
                const description = this.descriptions.createDescription(element, element.name, document);
                localDescriptions.push(description);
            } else if (isPackageDeclaration(element)) {
                const nestedDescriptions = await this.processContainer(element, scopes, document, cancelToken);
                for (const description of nestedDescriptions) {
                    // Add qualified names to the container
                    const qualified = this.createQualifiedDescription(element, description, document);
                    localDescriptions.push(qualified);
                }
            }
        }
        scopes.set(container, localDescriptions);
        return localDescriptions;
    }

    protected createQualifiedDescription(pack: PackageDeclaration, description: AstNodeDescription, document: LangiumDocument): AstNodeDescription {
        const name = (this.nameProvider as DomainModelNameProvider).getQualifiedName(pack.name, description.name);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.descriptions.createDescription(description.node!, name, document);
    }

}
