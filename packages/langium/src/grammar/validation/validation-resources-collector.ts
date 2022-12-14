/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { MultiMap } from '../../utils/collections';
import { stream } from '../../utils/stream';
import { LangiumDocuments } from '../../workspace/documents';
import { AbstractElement, Action, Grammar, Interface, isAction, isAlternatives, isGroup, isUnorderedGroup, ParserRule, Type } from '../generated/ast';
import { getActionType, getRuleType } from '../internal-grammar-util';
import { AstResources, collectTypeResources, TypeResources } from '../type-system/type-collector/all-types';
import { mergeInterfaces, mergeTypesAndInterfaces } from '../type-system/types-util';
import { Property } from '../type-system/type-collector/types';
import { TypeToValidationInfo, ValidationResources } from '../workspace/documents';
import { LangiumGrammarServices } from '../langium-grammar-module';

export class LangiumGrammarValidationResourcesCollector {
    private readonly documents: LangiumDocuments;

    constructor(services: LangiumGrammarServices) {
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    collectValidationResources(grammar: Grammar): ValidationResources {
        const typeResources = collectTypeResources(grammar, this.documents);
        return {
            typeToValidationInfo: this.collectValidationInfo(typeResources),
            typeToSuperProperties: this.collectSuperProperties(typeResources),
        };
    }

    private collectValidationInfo({ astResources, inferred, declared }: TypeResources) {
        const res: TypeToValidationInfo = new Map();
        const typeNameToRulesActions = collectNameToRulesActions(astResources);

        for (const type of mergeTypesAndInterfaces(inferred)) {
            res.set(
                type.name,
                { inferred: type, inferredNodes: typeNameToRulesActions.get(type.name) }
            );
        }

        const typeNametoInterfacesUnions = stream(astResources.interfaces)
            .concat(astResources.types)
            .reduce((acc, type) => acc.set(type.name, type),
                new Map<string, Type | Interface>()
            );
        for (const type of mergeTypesAndInterfaces(declared)) {
            const node = typeNametoInterfacesUnions.get(type.name);
            if (node) {
                const inferred = res.get(type.name);
                res.set(
                    type.name,
                    inferred ? {...inferred, declared: type, declaredNode: node } : { declared: type, declaredNode: node }
                );
            }
        }

        return res;
    }

    private collectSuperProperties({ inferred, declared }: TypeResources) {
        const typeToSuperProperties: Map<string, Property[]> = new Map();
        for (const type of mergeInterfaces(inferred, declared)) {
            typeToSuperProperties.set(type.name, Array.from(type.superProperties.values()));
        }
        return typeToSuperProperties;
    }
}

function collectNameToRulesActions({ parserRules, datatypeRules }: AstResources): MultiMap<string, ParserRule | Action> {
    const acc = new MultiMap<string, ParserRule | Action>();

    // collect rules
    stream(parserRules)
        .concat(datatypeRules)
        .forEach(rule => acc.add(getRuleType(rule), rule));

    // collect actions
    function collectActions(element: AbstractElement) {
        if (isAction(element)) {
            const name = getActionType(element);
            if (name) {
                acc.add(name, element);
            }
        } if (isAlternatives(element) || isGroup(element) || isUnorderedGroup(element)) {
            element.elements.forEach(e => collectActions(e));
        }
    }

    parserRules
        .forEach(rule => collectActions(rule.definition));

    return acc;
}
