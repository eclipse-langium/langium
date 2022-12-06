/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { MultiMap } from '../../utils/collections';
import { stream } from '../../utils/stream';
import { LangiumDocuments } from '../../workspace/documents';
import { AbstractElement, Action, Interface, isAction, isAlternatives, isGroup, isUnorderedGroup, ParserRule, Type } from '../generated/ast';
import { getActionType, getRuleType } from '../internal-grammar-util';
import { AstResources, collectTypeResources } from '../type-system/type-collector/all-types';
import { AstTypes, mergeInterfaces, Property } from '../type-system/types-util';
import { LangiumGrammarDocument, TypeOption, ValidationResources } from '../workspace/documents';

export class LangiumGrammarTypeCollector {

    collectValidationResources(documents: LangiumDocuments, document: LangiumGrammarDocument) {
        const validationResources: ValidationResources = new Map();
        const { astResources, inferred, declared } = collectTypeResources(documents, [document.parseResult.value]);

        const typeNameToRulesActions = new MultiMap<string, ParserRule | Action>();
        this.collectNameToRules(typeNameToRulesActions, astResources);
        this.collectNameToActions(typeNameToRulesActions, astResources);

        for (const type of mergeTypesAndInterfaces(inferred)) {
            validationResources.set(
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
                const inferred = validationResources.get(type.name);
                validationResources.set(
                    type.name,
                    inferred ? {...inferred, declared: type, declaredNode: node } : { declared: type, declaredNode: node }
                );
            }
        }

        const typeToItsSuperProperties: Map<string, Property[]> = new Map();
        for (const type of mergeInterfaces(inferred, declared)) {
            typeToItsSuperProperties.set(type.name, Array.from(type.superProperties.values()));
        }

        document.validationResources = validationResources;
        document.typeToItsSuperProperties = typeToItsSuperProperties;
    }

    private collectNameToRules(acc: MultiMap<string, ParserRule | Action>, {parserRules, datatypeRules}: AstResources) {
        return stream(parserRules)
            .concat(datatypeRules)
            .forEach(rule => acc.add(getRuleType(rule), rule));
    }

    private collectNameToActions(acc: MultiMap<string, ParserRule | Action>, {parserRules}: AstResources) {
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

        for (const rule of parserRules) {
            collectActions(rule.definition);
        }
    }
}

function mergeTypesAndInterfaces(astTypes: AstTypes): TypeOption[] {
    return (astTypes.interfaces as TypeOption[]).concat(astTypes.unions);
}
