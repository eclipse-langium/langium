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
import { AstResources, ValidationAstTypes } from '../type-system/type-collector/all-types';
import { mergeInterfaces, mergeTypesAndInterfaces } from '../type-system/types-util';
import { TypeToValidationInfo, ValidationResources } from '../workspace/documents';
import { LangiumGrammarServices } from '../langium-grammar-module';
import { collectValidationAst } from '../type-system/ast-collector';
import { InterfaceType, Property } from '../type-system';

export class LangiumGrammarValidationResourcesCollector {
    private readonly documents: LangiumDocuments;

    constructor(services: LangiumGrammarServices) {
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    collectValidationResources(grammar: Grammar): ValidationResources {
        const typeResources = collectValidationAst(grammar, this.documents);
        return {
            typeToValidationInfo: this.collectValidationInfo(typeResources),
            typeToSuperProperties: this.collectSuperProperties(typeResources),
        };
    }

    private collectValidationInfo({ astResources, inferred, declared }: ValidationAstTypes) {
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
                    { ...inferred ?? {}, declared: type, declaredNode: node }
                );
            }
        }

        return res;
    }

    private collectSuperProperties({ inferred, declared }: ValidationAstTypes): Map<string, Property[]> {
        const typeToSuperProperties: Map<string, Property[]> = new Map();
        const interfaces = mergeInterfaces(inferred, declared);
        const interfaceMap = new Map(interfaces.map(e => [e.name, e]));
        for (const type of mergeInterfaces(inferred, declared)) {
            typeToSuperProperties.set(type.name, this.addSuperProperties(type, interfaceMap, new Set()));
        }
        return typeToSuperProperties;
    }

    private addSuperProperties(interfaceType: InterfaceType, map: Map<string, InterfaceType>, visited: Set<string>): Property[] {
        if (visited.has(interfaceType.name)) {
            return [];
        }
        visited.add(interfaceType.name);
        const properties: Property[] = [...interfaceType.properties];
        for (const superType of interfaceType.superTypes) {
            const value = map.get(superType.name);
            if (value) {
                properties.push(...this.addSuperProperties(value, map, visited));
            }
        }
        return properties;
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
