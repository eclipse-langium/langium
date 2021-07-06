/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNodeDescription, DefaultScopeComputation, LangiumDocument, LangiumServices, PrecomputedScopes } from 'langium';
import { Domainmodel, isType, PackageDeclaration, isPackageDeclaration } from './generated/ast';

export class DomainModelScopeComputation extends DefaultScopeComputation {

    constructor(services: LangiumServices) {
        super(services);
    }

    computeScope(document: LangiumDocument): PrecomputedScopes {
        const model = document.parseResult?.value as Domainmodel;
        const scopes = new Map();
        this.processContainer(model, scopes, document);
        return scopes;
    }

    protected processContainer(container: Domainmodel | PackageDeclaration, scopes: PrecomputedScopes, document: LangiumDocument): AstNodeDescription[] {
        const localDescriptions: AstNodeDescription[] = [];
        for (const element of container.elements) {
            if (isType(element)) {
                const description = this.createDescription(element, element.name, document);
                localDescriptions.push(description);
            } else if (isPackageDeclaration(element)) {
                const nestedDescriptions = this.processContainer(element, scopes, document);
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
        const name = pack.name + '.' + description.name;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.createDescription(description.node!, name, document);
    }

}
