/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { GrammarAST } from 'langium';
import { SerializationContext } from './serialization-cache';
import { isOptionalCardinality } from './utils';

export interface ValueDescription {
    property: string
    value: unknown
}

export type ValueDescriptionMap = Map<string, ValueDescription>;

export function toValueDescriptionMap(values: ValueDescription[]): ValueDescriptionMap {
    return new Map(values.map(e => [e.property, e]));
}

export type ItemDescription = PropertyDescription | GroupPropertyDescription | AlternativesPropertyDescription;

export interface PropertyDescription {
    property: string
    optional: boolean
    source: GrammarAST.AbstractElement
}

export function isPropertyDescription(item: ItemDescription): item is PropertyDescription {
    return 'property' in item;
}

export interface GroupPropertyDescription {
    elements: ItemDescription[]
    optional: boolean
    source: GrammarAST.AbstractElement
}

export function isGroupPropertyDescription(item: ItemDescription): item is GroupPropertyDescription {
    return 'elements' in item;
}

export interface AlternativesPropertyDescription {
    alternatives: ItemDescription[]
    optional: boolean
    source: GrammarAST.AbstractElement
}

export function isAlternativesPropertyDescription(item: ItemDescription): item is AlternativesPropertyDescription {
    return 'alternatives' in item;
}

export function getGrammarPropertyDescriptions(context: SerializationContext, element: GrammarAST.AbstractElement): ItemDescription | undefined {
    return context.cache.getPropertyDescriptions(element, item => buildPropertyDescription(context, item));
}

function buildPropertyDescription(context: SerializationContext, element: GrammarAST.AbstractElement): ItemDescription | undefined {
    if (GrammarAST.isAssignment(element)) {
        return {
            property: element.feature,
            optional: isOptionalCardinality(element.cardinality),
            source: element
        };
    } else if (GrammarAST.isRuleCall(element)) {
        const rule = element.rule.ref!;
        const ruleDescriptions = getGrammarPropertyDescriptions(context, rule.definition);
        if (ruleDescriptions) {
            return {
                ...ruleDescriptions,
                optional: isOptionalCardinality(element.cardinality),
                source: element
            };
        } else {
            return undefined;
        }
    } else if (GrammarAST.isGroup(element)) {
        const descriptions: ItemDescription[] = [];
        for (const item of element.elements) {
            const description = getGrammarPropertyDescriptions(context, item);
            if (description) {
                descriptions.push(description);
            }
        }
        return {
            elements: descriptions,
            optional: isOptionalCardinality(element.cardinality),
            source: element
        };
    } else if (GrammarAST.isAction(element)) {
        if (element.feature) {
            return {
                property: element.feature,
                optional: false,
                source: element
            };
        } else {
            return undefined;
        }
    } else if (GrammarAST.isAlternatives(element)) {
        const alternatives: ItemDescription[] = [];
        for (const item of element.elements) {
            const description = getGrammarPropertyDescriptions(context, item);
            if (description) {
                alternatives.push(description);
            }
        }
        return {
            alternatives: alternatives,
            optional: isOptionalCardinality(element.cardinality),
            source: element
        };
    }
    return undefined;
}
