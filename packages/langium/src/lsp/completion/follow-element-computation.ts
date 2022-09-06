/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken } from 'chevrotain';
import * as ast from '../../grammar/generated/ast';
import { Cardinality, getCrossReferenceTerminal, getExplicitRuleType, getTypeName, isArray, isOptional, terminalRegex } from '../../grammar/grammar-util';
import { isAstNode } from '../../utils/ast-util';

export interface NextFeature<T extends ast.AbstractElement = ast.AbstractElement> {
    /**
     * A feature that could appear during completion.
     */
    feature: T
    /**
     * The type that carries this `feature`. Only set if we encounter a new type.
     */
    type?: string
    /**
     * The container property for the new `type`
     */
    property?: string
    /**
     * Determines whether this `feature` is directly preceded by a new object declaration (such as an action or a rule call)
     */
    new?: boolean
}

/**
 * Calculates any features that can follow the given feature stack.
 * This also includes features following optional features and features from previously called rules that could follow the last feature.
 * @param featureStack A stack of features starting at the entry rule and ending at the feature of the current cursor position.
 * @param unparsedTokens All tokens which haven't been parsed successfully yet. This is the case when we call this function inside an alternative.
 * @returns Any `AbstractElement` that could be following the given feature stack.
 */
export function findNextFeatures(featureStack: NextFeature[][], unparsedTokens: IToken[]): NextFeature[] {
    const context: InterpretationContext = {
        stacks: featureStack,
        tokens: unparsedTokens
    };
    interpretTokens(context);
    // Reset the container property
    context.stacks.flat().forEach(feature => { feature.property = undefined; });
    const nextStacks = findNextFeatureStacks(context.stacks);
    // We only need the last element of each stack
    return nextStacks.map(e => e[e.length - 1]);
}

function findNextFeaturesInternal(nextFeature: NextFeature, cardinalities = new Map<ast.AbstractElement, Cardinality>(), visited = new Set<ast.AbstractElement>()): NextFeature[] {
    const features: NextFeature[] = [];
    const feature = nextFeature.feature;
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
        features.push(...findFirstFeatures({ feature: item, type: nextFeature.type, new: false }, cardinalities, visited));
    }
    if (parent) {
        const ownIndex = parent.elements.indexOf(item);
        // Find next elements of the same group
        if (ownIndex !== undefined && ownIndex < parent.elements.length - 1) {
            features.push(...findNextFeaturesInGroup({ feature: parent, type: nextFeature.type, new: false }, ownIndex + 1, cardinalities, visited));
        }
        // Don't test for `isOptional` on the cardinality. We also want to find the next elements after `+`
        if (features.every(e => e.feature.cardinality || cardinalities.get(e.feature))) {
            // secondly, try to find the next elements of the parent
            features.push(...findNextFeaturesInternal({ feature: parent, type: nextFeature.type, new: false }, cardinalities, visited));
        }
    }
    return features;
}

/**
 * Calculates the first child feature of any `AbstractElement`.
 * @param next The `AbstractElement` whose first child features should be calculated.
 * @returns A list of features that could be the first feature of the given `AbstractElement`.
 * These features contain a modified `cardinality` property. If the given `feature` is optional, the returned features will be optional as well.
 */
export function findFirstFeatures(next: ast.AbstractElement | NextFeature | undefined, cardinalities = new Map<ast.AbstractElement, Cardinality>(), visited = new Set<ast.AbstractElement>()): NextFeature[] {
    if (next === undefined) {
        return [];
    }
    if (isAstNode(next)) {
        next = { feature: next };
    }
    const { feature, type } = next;
    if (ast.isGroup(feature)) {
        if (visited.has(feature)) {
            return [];
        } else {
            visited.add(feature);
        }
    }
    if (ast.isGroup(feature)) {
        return findNextFeaturesInGroup(next as NextFeature<ast.Group>, 0, cardinalities, visited)
            .map(e => modifyCardinality(e, feature.cardinality, cardinalities));
    } else if (ast.isAlternatives(feature) || ast.isUnorderedGroup(feature)) {
        return feature.elements.flatMap(e => findFirstFeatures({ feature: e, new: false, type }, cardinalities, visited))
            .map(e => modifyCardinality(e, feature.cardinality, cardinalities));
    } else if (ast.isAssignment(feature)) {
        next = {
            feature: feature.terminal,
            new: false,
            type,
            property: next.property ?? feature.feature
        };
        return findFirstFeatures(next, cardinalities, visited)
            .map(e => modifyCardinality(e, feature.cardinality, cardinalities));
    } else if (ast.isAction(feature)) {
        return findNextFeaturesInternal({
            feature,
            new: true,
            type: getTypeName(feature),
            property: next.property ?? feature.feature
        }, cardinalities, visited);
    } else if (ast.isRuleCall(feature) && ast.isParserRule(feature.rule.ref)) {
        const rule = feature.rule.ref;
        next = {
            feature: rule.definition,
            new: true,
            type: rule.fragment ? undefined : getExplicitRuleType(rule) ?? rule.name,
            property: next.property
        };
        return findFirstFeatures(next, cardinalities, visited)
            .map(e => modifyCardinality(e, feature.cardinality, cardinalities));
    } else {
        return [next];
    }
}

/**
 * Modifying the cardinality is necessary to identify which features are coming from an optional feature.
 * Those features should be optional as well.
 * @param next The next feature that could be made optionally.
 * @param cardinality The cardinality of the calling (parent) object.
 * @returns A new feature that could be now optional (`?` or `*`).
 */
function modifyCardinality(next: NextFeature, cardinality: Cardinality, cardinalities: Map<ast.AbstractElement, Cardinality>): NextFeature {
    cardinalities.set(next.feature, cardinality);
    return next;
}

function findNextFeaturesInGroup(next: NextFeature<ast.Group>, index: number, cardinalities: Map<ast.AbstractElement, Cardinality>, visited: Set<ast.AbstractElement>): NextFeature[] {
    const features: NextFeature[] = [];
    let firstFeature: NextFeature;
    while (index < next.feature.elements.length) {
        firstFeature = { feature: next.feature.elements[index++], new: false, type: next.type };
        features.push(...findFirstFeatures(firstFeature, cardinalities, visited));
        if (!isOptional(firstFeature.feature.cardinality ?? cardinalities.get(firstFeature.feature))) {
            break;
        }
    }
    return features;
}

interface InterpretationContext {
    tokens: IToken[]
    stacks: NextFeature[][]
}

function interpretTokens(context: InterpretationContext): void {
    for (const token of context.tokens) {
        const nextFeatureStacks = findNextFeatureStacks(context.stacks, token);
        context.stacks = nextFeatureStacks;
    }
}

function findNextFeatureStacks(stacks: NextFeature[][], token?: IToken): NextFeature[][] {
    const newStacks: NextFeature[][] = [];
    for (const stack of stacks) {
        newStacks.push(...interpretStackToken(stack, token));
    }
    return newStacks;
}

function interpretStackToken(stack: NextFeature[], token?: IToken): NextFeature[][] {
    const cardinalities = new Map<ast.AbstractElement, Cardinality>();
    const newStacks: NextFeature[][] = [];
    while (stack.length > 0) {
        const top = stack.pop()!;
        const allNextFeatures = findNextFeaturesInternal(top, cardinalities).filter(next => token ? featureMatches(next.feature, token) : true);
        for (const nextFeature of allNextFeatures) {
            newStacks.push([...stack, nextFeature]);
        }
        if (!allNextFeatures.every(e => isOptional(e.feature.cardinality) || isOptional(cardinalities.get(e.feature)))) {
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
        return ruleFeatures.some(e => featureMatches(e.feature, token));
    } else if (ast.isTerminalRule(rule)) {
        // We have to take keywords into account
        // e.g. most keywords are valid IDs as well
        // Only return 'true' if this terminal does not match a keyword. TODO
        return new RegExp(terminalRegex(rule)).test(token.image);
    } else {
        return false;
    }
}