/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as ast from '../../grammar/generated/ast';
import { Cardinality, isArray, isOptional } from '../../grammar/grammar-util';
import _ from 'lodash';
/**
 * Calculates any features that can follow the given feature stack.
 * This also includes features following optional features and features from previously called rules that could follow the last feature.
 * @param featureStack A stack of features starting at the entry rule and ending at the feature of the current cursor position.
 * @returns Any `AbstractElement` that could be following the given feature stack.
 */
export function findNextFeatures(featureStack: ast.AbstractElement[]): ast.AbstractElement[] {
    return findNextFeaturesInternal(featureStack, new Map<ast.AbstractElement, Cardinality>());
}

export function findNextFeaturesInternal(featureStack: ast.AbstractElement[], cardinalities: Map<ast.AbstractElement, Cardinality>): ast.AbstractElement[] {
    if (featureStack.length === 0) {
        return [];
    }
    const features: ast.AbstractElement[] = [];
    const feature = featureStack[0];
    let parent: ast.Group | undefined;
    let item = feature;
    while (item.$container) {
        if (ast.isGroup(item.$container)) {
            parent = item.$container;
            break;
        } else if (ast.isAbstractElement(item.$container)) {
            item = item.$container;
        } else {
            break;
        }
    }
    // First try to iterate the same element again
    if (isArray(item.cardinality ?? cardinalities.get(item))) {
        features.push(...findFirstFeatures(item, cardinalities));
    }
    if (parent) {
        const ownIndex = parent.elements.indexOf(item);
        // Find next elements of the same group
        if (ownIndex !== undefined && ownIndex < parent.elements.length - 1) {
            features.push(...findNextFeaturesInGroup(parent, ownIndex + 1, cardinalities));
        }
        if (features.every(e => isOptional(e.cardinality ?? cardinalities.get(e)))) {
            // secondly, try to find the next elements of the parent
            features.push(...findNextFeaturesInternal([parent], cardinalities));
        }
        if (features.every(e => isOptional(e.cardinality ?? cardinalities.get(e)))) {
            // lasty, climb the feature stack and calculate completion for previously called rules
            featureStack.shift();
            features.push(...findNextFeaturesInternal(featureStack, cardinalities));
        }
    } else {
        // Climb the feature stack if this feature is the only one in a rule
        featureStack.shift();
        features.push(...findNextFeaturesInternal(featureStack, cardinalities));
    }
    return features;
}

/**
 * Calculates the first child feature of any `AbstractElement`.
 * @param feature The `AbstractElement` whose first child features should be calculated.
 * @returns A list of features that could be the first feature of the given `AbstractElement`.
 * These features contain a modified `cardinality` property. If the given `feature` is optional, the returned features will be optional as well.
 */
export function findFirstFeatures(feature: ast.AbstractElement | undefined, cardinalities?: Map<ast.AbstractElement, Cardinality>): ast.AbstractElement[] {
    const card = cardinalities ?? new Map();
    if (feature === undefined) {
        return [];
    } else if (ast.isGroup(feature)) {
        return findNextFeaturesInGroup(feature, 0, card)
            .map(e => modifyCardinality(e, feature.cardinality, card));
    } else if (ast.isAlternatives(feature)) {
        return feature.elements.flatMap(e => findFirstFeatures(e, card))
            .map(e => modifyCardinality(e, feature.cardinality, card));
    } else if (ast.isUnorderedGroup(feature)) {
        // TODO: Do we want to continue supporting unordered groups?
        return [];
    } else if (ast.isAssignment(feature)) {
        return findFirstFeatures(feature.terminal, card)
            .map(e => modifyCardinality(e, feature.cardinality, card));
    } else if (ast.isAction(feature)) {
        return findNextFeaturesInternal([feature], card)
            .map(e => modifyCardinality(e, feature.cardinality, card));
    } else if (ast.isRuleCall(feature) && ast.isParserRule(feature.rule.ref)) {
        return findFirstFeatures(feature.rule.ref.alternatives, card)
            .map(e => modifyCardinality(e, feature.cardinality, card));
    } else {
        return [feature];
    }
}

/**
 * Modifying the cardinality is necessary to identify which features are coming from an optional feature.
 * Those features should be optional as well.
 * @param feature The next feature that could be made optionally.
 * @param cardinality The cardinality of the calling (parent) object.
 * @returns A new feature that could be now optional (`?` or `*`).
 */
function modifyCardinality(feature: ast.AbstractElement, cardinality: Cardinality, cardinalities: Map<ast.AbstractElement, Cardinality>): ast.AbstractElement {
    if (isOptional(cardinality)) {
        if (isArray(feature.cardinality)) {
            cardinalities.set(feature, '*');
        } else {
            cardinalities.set(feature, '?');
        }
    }
    return feature;
}

function findNextFeaturesInGroup(group: ast.Group, index: number, cardinalities: Map<ast.AbstractElement, Cardinality>): ast.AbstractElement[] {
    const features: ast.AbstractElement[] = [];
    let firstFeature: ast.AbstractElement;
    do {
        firstFeature = group.elements[index++];
        features.push(...findFirstFeatures(firstFeature, cardinalities));
        if (!isOptional(firstFeature?.cardinality ?? cardinalities.get(firstFeature))) {
            break;
        }
    } while (firstFeature);
    return features;
}

///////////////////////////////////////////////////////////////////////////////

interface RuleMem {
    isCyclic: boolean,
    path?: ast.AbstractElement[],
    firstFeatures?: ast.AbstractElement[]
}

interface ExtractCyclicData {
    mem: Map<ast.ParserRule, RuleMem>,
    cardinalities: Map<ast.AbstractElement, Cardinality>,
    visited: ast.AbstractElement[]
}

interface CyclicRule {
    rule: ast.ParserRule,
    path: string
}

export function extractCyclicDef(rules: ast.AbstractRule[]): CyclicRule[] {
    const parserRules: ast.ParserRule[] = rules.filter(ast.isParserRule);

    return parserRules.reduce((res, rule) => {
        const data: ExtractCyclicData = { mem: new Map(), cardinalities: new Map(), visited: [] };
        if (!data.mem.has(rule)) {
            const firstFeatures = findFirstFeaturesWithCyclicDef(rule.alternatives, data);
            data.mem.set(rule, firstFeatures === undefined ?
                { isCyclic: true, path: data.visited } :
                { isCyclic: false, firstFeatures });
        }
        if (data.mem.get(rule)?.isCyclic) {
            res.push({rule, path: formatCyclicPath(rule.name, data.mem.get(rule)?.path, parserRules.map(rule => rule.name))});
        }
        return res;
    }, <CyclicRule[]>[]);
}

function formatCyclicPath(entryRuleName: string, path: ast.AbstractElement[] | undefined, ruleNames: string[]): string {
    const splitter = ' > ';
    const stringPath = (path ?? [])
        .map(feature => feature.$cstNode?.text)
        .filter(name => ruleNames.includes(name ?? ''));
    return [entryRuleName, stringPath.join(splitter)].join(splitter);
}

function findFirstFeaturesWithCyclicDef(feature: ast.AbstractElement, data: ExtractCyclicData): ast.AbstractElement[] | undefined {
    if (!feature) return [];

    if (data.visited.includes(feature)) {
        data.visited.push(feature);
        return undefined;
    }
    data.visited.push(feature);

    if (ast.isGroup(feature)) {
        const firstFeatures: ast.AbstractElement[] = [];
        let index = 0;
        let firstFeatureInGroup: ast.AbstractElement;
        do {
            firstFeatureInGroup = feature.elements[index++];
            const currFirstFeatures = findFirstFeaturesWithCyclicDef(firstFeatureInGroup, data);
            if (!currFirstFeatures) return undefined;
            firstFeatures.push(...currFirstFeatures);
        } while (firstFeatureInGroup && isOptional(firstFeatureInGroup.cardinality ?? data.cardinalities.get(firstFeatureInGroup)));
        return firstFeatures?.map(e => modifyCardinality(e, feature.cardinality, data.cardinalities));
    }
    if (ast.isAlternatives(feature)) {
        const firstFeatures: ast.AbstractElement[] = [];
        let index = 0;
        let backupVisited: ast.AbstractElement[];
        let altFeature: ast.AbstractElement;
        do {
            backupVisited = _.cloneDeep(data.visited);
            altFeature = feature.elements[index++];
            const currFirstFeatures = findFirstFeaturesWithCyclicDef(altFeature, data);
            if (!currFirstFeatures) {
                return undefined;
            }
            firstFeatures.push(...currFirstFeatures);
            data.visited = backupVisited;
        } while (index < feature.elements.length);
        return firstFeatures?.map(e => modifyCardinality(e, feature.cardinality, data.cardinalities));
    }
    if (ast.isUnorderedGroup(feature)) {
        // TODO: Do we want to continue supporting unordered groups?
        return [];
    }
    if (ast.isAction(feature)) {
        return findNextFeaturesInternal([feature], data.cardinalities)
            .map(e => modifyCardinality(e, feature.cardinality, data.cardinalities));
    }
    if (ast.isAssignment(feature)) {
        return findFirstFeaturesWithCyclicDef(feature.terminal, data)
            ?.map(e => modifyCardinality(e, feature.cardinality, data.cardinalities));
    }
    if (ast.isRuleCall(feature) && ast.isParserRule(feature.rule.ref)) {
        const refRule = feature.rule.ref;
        if (!data.mem.has(refRule)) {
            const firstFeatures = findFirstFeaturesWithCyclicDef(refRule.alternatives, data)
                ?.map(e => modifyCardinality(e, feature.cardinality, data.cardinalities));
            data.mem.set(refRule, firstFeatures === undefined ? {isCyclic: true, path: data.visited } : { isCyclic: false, firstFeatures });
        }
        return data.mem.get(refRule)?.firstFeatures;
    }
    return [feature];
}
