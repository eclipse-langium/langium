/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken } from 'chevrotain';
import * as ast from '../../grammar/generated/ast';
import { Cardinality, getExplicitRuleType, getTypeName, isArrayCardinality, isOptionalCardinality, terminalRegex } from '../../grammar/internal-grammar-util';
import { isAstNode } from '../../syntax-tree';
import { getContainerOfType } from '../../utils/ast-util';
import { getCrossReferenceTerminal } from '../../utils/grammar-util';

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

function findNextFeaturesInternal(options: { next: NextFeature, cardinalities: Map<ast.AbstractElement, Cardinality>, visited: Set<ast.AbstractElement>, plus: Set<ast.AbstractElement> }): NextFeature[] {
    const { next, cardinalities, visited, plus } = options;
    const features: NextFeature[] = [];
    const feature = next.feature;
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
    if (isArrayCardinality(item.cardinality)) {
        const repeatingFeatures = findFirstFeaturesInternal({
            next: {
                feature: item,
                type: next.type,
                new: false
            },
            cardinalities,
            visited,
            plus
        });
        for (const repeatingFeature of repeatingFeatures) {
            plus.add(repeatingFeature.feature);
        }
        features.push(...repeatingFeatures);
    }
    if (parent) {
        const ownIndex = parent.elements.indexOf(item);
        // Find next elements of the same group
        if (ownIndex !== undefined && ownIndex < parent.elements.length - 1) {
            features.push(...findNextFeaturesInGroup({
                feature: parent,
                type: next.type,
                new: false
            }, ownIndex + 1, cardinalities, visited, plus));
        }
        // Try to find the next elements of the parent
        // Only do this if every following element is either optional or has been parsed as +
        if (features.every(e => isOptionalCardinality(e.feature.cardinality) || isOptionalCardinality(cardinalities.get(e.feature)) || plus.has(e.feature))) {
            features.push(...findNextFeaturesInternal({
                next: {
                    feature: parent,
                    type: next.type,
                    new: false
                },
                cardinalities,
                visited,
                plus
            }));
        }
    }
    return features;
}

/**
 * Calculates the first child feature of any `AbstractElement`.
 * @param next The `AbstractElement` whose first child features should be calculated.
 */
export function findFirstFeatures(next: ast.AbstractElement | NextFeature): NextFeature[] {
    if (isAstNode(next)) {
        next = { feature: next };
    }
    return findFirstFeaturesInternal({ next, cardinalities: new Map(), visited: new Set(), plus: new Set() });
}

function findFirstFeaturesInternal(options: { next: NextFeature, cardinalities: Map<ast.AbstractElement, Cardinality>, visited: Set<ast.AbstractElement>, plus: Set<ast.AbstractElement> }): NextFeature[] {
    const { next, cardinalities, visited, plus } = options;
    if (next === undefined) {
        return [];
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
        return findNextFeaturesInGroup(next as NextFeature<ast.Group>, 0, cardinalities, visited, plus)
            .map(e => modifyCardinality(e, feature.cardinality, cardinalities));
    } else if (ast.isAlternatives(feature) || ast.isUnorderedGroup(feature)) {
        return feature.elements.flatMap(e => findFirstFeaturesInternal({
            next: { feature: e, new: false, type },
            cardinalities,
            visited,
            plus
        }))
            .map(e => modifyCardinality(e, feature.cardinality, cardinalities));
    } else if (ast.isAssignment(feature)) {
        const assignmentNext = {
            feature: feature.terminal,
            new: false,
            type,
            property: next.property ?? feature.feature
        };
        return findFirstFeaturesInternal({ next: assignmentNext, cardinalities, visited, plus })
            .map(e => modifyCardinality(e, feature.cardinality, cardinalities));
    } else if (ast.isAction(feature)) {
        return findNextFeaturesInternal({
            next: {
                feature,
                new: true,
                type: getTypeName(feature),
                property: next.property ?? feature.feature
            },
            cardinalities,
            visited,
            plus
        });
    } else if (ast.isRuleCall(feature) && ast.isParserRule(feature.rule.ref)) {
        const rule = feature.rule.ref;
        const ruleCallNext = {
            feature: rule.definition,
            new: true,
            type: rule.fragment ? undefined : getExplicitRuleType(rule) ?? rule.name,
            property: next.property
        };
        return findFirstFeaturesInternal({ next: ruleCallNext, cardinalities, visited, plus })
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

function findNextFeaturesInGroup(next: NextFeature<ast.Group>, index: number, cardinalities: Map<ast.AbstractElement, Cardinality>, visited: Set<ast.AbstractElement>, plus: Set<ast.AbstractElement>): NextFeature[] {
    const features: NextFeature[] = [];
    let firstFeature: NextFeature;
    while (index < next.feature.elements.length) {
        firstFeature = { feature: next.feature.elements[index++], new: false, type: next.type };
        features.push(...findFirstFeaturesInternal({
            next: firstFeature,
            cardinalities,
            visited,
            plus
        }));
        if (!isOptionalCardinality(firstFeature.feature.cardinality ?? cardinalities.get(firstFeature.feature))) {
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
    const plus = new Set<ast.AbstractElement>(stack.map(e => e.feature).filter(isPlusFeature));
    const newStacks: NextFeature[][] = [];
    while (stack.length > 0) {
        const top = stack.pop()!;
        const allNextFeatures = findNextFeaturesInternal({
            next: top,
            cardinalities,
            plus,
            visited: new Set()
        }).filter(next => token ? featureMatches(next.feature, token) : true);
        for (const nextFeature of allNextFeatures) {
            newStacks.push([...stack, nextFeature]);
        }
        if (!allNextFeatures.every(e => isOptionalCardinality(e.feature.cardinality) || isOptionalCardinality(cardinalities.get(e.feature)))) {
            break;
        }
    }
    return newStacks;
}

function isPlusFeature(feature: ast.AbstractElement): boolean {
    if (feature.cardinality === '+') {
        return true;
    }
    const assignment = getContainerOfType(feature, ast.isAssignment);
    if (assignment && assignment.cardinality === '+') {
        return true;
    }
    return false;
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
        const ruleFeatures = findFirstFeatures(rule.definition);
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
