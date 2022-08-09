/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken } from 'chevrotain';
import * as ast from '../../grammar/generated/ast';
import { Cardinality, getCrossReferenceTerminal, isArray, isOptional, terminalRegex } from '../../grammar/grammar-util';

/**
 * Calculates any features that can follow the given feature stack.
 * This also includes features following optional features and features from previously called rules that could follow the last feature.
 * @param featureStack A stack of features starting at the entry rule and ending at the feature of the current cursor position.
 * @returns Any `AbstractElement` that could be following the given feature stack.
 */
export function findNextFeatures(featureStack: ast.AbstractElement[], unparsedTokens: IToken[]): ast.AbstractElement[] {
    const context: InterpretationContext = {
        stacks: [featureStack],
        tokens: unparsedTokens
    };
    interpreteTokens(context);
    const nextStacks = findNextFeatureStacks(context.stacks);
    // We only need the last element of each stack
    return nextStacks.map(e => e[e.length - 1]);
}

function findNextFeaturesInternal(feature: ast.AbstractElement, cardinalities = new Map<ast.AbstractElement, Cardinality>(), visited = new Set<ast.AbstractElement>()): ast.AbstractElement[] {
    const features: ast.AbstractElement[] = [];
    if (visited.has(feature)) {
        return [];
    } else {
        visited.add(feature);
    }
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
    if (isArray(item.cardinality)) {
        features.push(...findFirstFeatures(item, cardinalities, visited));
    }
    if (parent) {
        const ownIndex = parent.elements.indexOf(item);
        // Find next elements of the same group
        if (ownIndex !== undefined && ownIndex < parent.elements.length - 1) {
            features.push(...findNextFeaturesInGroup(parent, ownIndex + 1, cardinalities, visited));
        }
        // Don't test for `isOptional` on the cardinality. We also want to find the next elements after `+`
        if (features.every(e => e.cardinality || cardinalities.get(e))) {
            // secondly, try to find the next elements of the parent
            features.push(...findNextFeaturesInternal(parent, cardinalities, visited));
        }
    }
    return features;
}

/**
 * Calculates the first child feature of any `AbstractElement`.
 * @param feature The `AbstractElement` whose first child features should be calculated.
 * @returns A list of features that could be the first feature of the given `AbstractElement`.
 * These features contain a modified `cardinality` property. If the given `feature` is optional, the returned features will be optional as well.
 */
export function findFirstFeatures(feature: ast.AbstractElement | undefined, cardinalities: Map<ast.AbstractElement, Cardinality>, visited: Set<ast.AbstractElement>): ast.AbstractElement[] {
    if (ast.isGroup(feature)) {
        if (visited.has(feature)) {
            return [];
        } else {
            visited.add(feature);
        }
    }
    const card = cardinalities ?? new Map();
    visited = visited ?? new Set();
    if (feature === undefined) {
        return [];
    } else if (ast.isGroup(feature)) {
        return findNextFeaturesInGroup(feature, 0, card, visited)
            .map(e => modifyCardinality(e, feature.cardinality, card));
    } else if (ast.isAlternatives(feature) || ast.isUnorderedGroup(feature)) {
        return feature.elements.flatMap(e => findFirstFeatures(e, card, visited))
            .map(e => modifyCardinality(e, feature.cardinality, card));
    } else if (ast.isAssignment(feature)) {
        return findFirstFeatures(feature.terminal, card, visited)
            .map(e => modifyCardinality(e, feature.cardinality, card));
    } else if (ast.isAction(feature)) {
        return findNextFeaturesInternal(feature, card, visited);
    } else if (ast.isRuleCall(feature) && ast.isParserRule(feature.rule.ref)) {
        return findFirstFeatures(feature.rule.ref.definition, card, visited)
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
    cardinalities.set(feature, cardinality);
    return feature;
}

function findNextFeaturesInGroup(group: ast.Group, index: number, cardinalities: Map<ast.AbstractElement, Cardinality>, visited: Set<ast.AbstractElement>): ast.AbstractElement[] {
    const features: ast.AbstractElement[] = [];
    let firstFeature: ast.AbstractElement;
    do {
        firstFeature = group.elements[index++];
        if (ast.isAction(firstFeature)) {
            continue;
        }
        features.push(...findFirstFeatures(firstFeature, cardinalities, visited));
        if (!isOptional(firstFeature?.cardinality ?? cardinalities.get(firstFeature))) {
            break;
        }
    } while (firstFeature);
    return features;
}

interface InterpretationContext {
    tokens: IToken[]
    stacks: ast.AbstractElement[][]
}

function interpreteTokens(context: InterpretationContext): void {
    while (context.tokens.length > 0) {
        const token = context.tokens.pop()!;
        const nextFeatureStacks = findNextFeatureStacks(context.stacks, token);
        context.stacks = nextFeatureStacks;
    }
}

function findNextFeatureStacks(stacks: ast.AbstractElement[][], token?: IToken): ast.AbstractElement[][] {
    const newStacks: ast.AbstractElement[][] = [];
    for (const stack of stacks) {
        newStacks.push(...interpreteStackToken(stack, token));
    }
    return newStacks;
}

function interpreteStackToken(stack: ast.AbstractElement[], token?: IToken): ast.AbstractElement[][] {
    const cardinalities = new Map<ast.AbstractElement, Cardinality>();
    const newStacks: ast.AbstractElement[][] = [];
    while (stack.length > 0) {
        const top = stack.pop()!;
        const allNextFeatures = findNextFeaturesInternal(top, cardinalities).filter(next => token ? featureMatches(next, token) : true);
        for (const nextFeature of allNextFeatures) {
            newStacks.push([...stack, nextFeature]);
        }
        if (!allNextFeatures.every(e => isOptional(e.cardinality) || isOptional(cardinalities.get(e)))) {
            break;
        }
    }
    return newStacks;
}

function featureMatches(feature: ast.AbstractElement, token: IToken): boolean {
    if (ast.isKeyword(feature)) {
        const content = feature.value;
        return content === token.image;
    } else if (ast.isRuleCall(feature)) {
        return ruleMatches(feature.rule.ref, token);
    } else if (ast.isCrossReference(feature)) {
        const crossRefTerminal = getCrossReferenceTerminal(feature);
        if (crossRefTerminal) {
            return featureMatches(crossRefTerminal, token);
        }
    }
    return false;
}

function ruleMatches(rule: ast.AbstractRule | undefined, token: IToken): boolean {
    if (ast.isParserRule(rule)) {
        const ruleFeatures = findFirstFeatures(rule.definition, new Map(), new Set());
        return ruleFeatures.some(e => featureMatches(e, token));
    } else if (ast.isTerminalRule(rule)) {
        // We have to take keywords into account
        // e.g. most keywords are valid IDs as well
        // Only return 'true' if this terminal does not match a keyword. TODO
        return new RegExp(terminalRegex(rule)).test(token.image);
    } else {
        return false;
    }
}