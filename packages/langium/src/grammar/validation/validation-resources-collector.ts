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
import { addSubTypes, mergeInterfaces, mergeTypesAndInterfaces } from '../type-system/types-util';
import { isUnionType, Property, TypeOption } from '../type-system/type-collector/types';
import { isDeclared, TypeToValidationInfo, ValidationResources } from '../workspace/documents';
import { LangiumGrammarServices } from '../langium-grammar-module';

export class LangiumGrammarValidationResourcesCollector {
    private readonly documents: LangiumDocuments;

    constructor(services: LangiumGrammarServices) {
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    collectValidationResources(grammar: Grammar): ValidationResources {
        const typeResources = collectTypeResources(grammar, this.documents);
        const typeToValidationInfo = this.collectValidationInfo(typeResources);
        const typeToSuperProperties = this.collectSuperProperties(typeResources);
        const typeToAliases = this.collectSubTypesAndAliases(typeToValidationInfo);
        return { typeToValidationInfo, typeToSuperProperties, typeToAliases };
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

    private collectSuperProperties({ inferred, declared }: TypeResources): Map<string, Property[]> {
        const typeToSuperProperties: Map<string, Property[]> = new Map();
        for (const type of mergeInterfaces(inferred, declared)) {
            typeToSuperProperties.set(type.name, Array.from(type.superProperties.values()));
        }
        return typeToSuperProperties;
    }

    private collectSubTypesAndAliases(typeToValidationInfo: TypeToValidationInfo): Map<string, Set<string>> {
        const nameToType = stream(typeToValidationInfo.entries())
            .reduce((acc, [name, info]) => { acc.set(name, isDeclared(info) ? info.declared : info.inferred);  return acc; },
                new Map<string, TypeOption>()
            );
        addSubTypes(nameToType);

        const typeToAliases = new Map<string, Set<string>>();
        function addAlias(name: string, alias: string) {
            const aliases = typeToAliases.get(name);
            if (aliases) {
                aliases.add(alias);
            } else {
                typeToAliases.set(name, new Set([alias]));
            }
        }

        const queue = Array.from(nameToType.values()).filter(e => e.subTypes.size === 0);
        const visited = new Set<TypeOption>();
        for (const type of queue) {
            visited.add(type);
            addAlias(type.name, type.name);

            for (const superTypeName of stream(type.realSuperTypes)) {
                addAlias(superTypeName, type.name);

                const superType = nameToType.get(superTypeName);
                if (superType && !visited.has(superType)) {
                    queue.push(superType);
                }
            }

            if (isUnionType(type) && type.alternatives.length === 1) {
                type.alternatives
                    .filter(alt => !alt.array && !alt.reference)
                    .flatMap(alt => alt.types)
                    .forEach(e => {
                        addAlias(type.name, e);
                        addAlias(e, e);
                        addAlias(e, type.name);
                    });
            }
        }
        return typeToAliases;
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
