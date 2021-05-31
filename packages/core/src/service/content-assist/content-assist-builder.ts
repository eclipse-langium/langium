import * as ast from '../../gen/ast';
import { Cardinality, isArray, isOptional } from '../../generator/utils';

export function findNextFeatures(featureStack: ast.AbstractElement[]): ast.AbstractElement[] {
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
    if (isArray(item.cardinality)) {
        features.push(...findFirstFeatures(item));
    }
    if (parent) {
        const ownIndex = parent.elements.indexOf(item);
        // Find next elements of the same group
        if (ownIndex !== undefined && ownIndex < parent.elements.length - 1) {
            features.push(...findNextFeaturesInGroup(parent, ownIndex + 1));
        }
        if (features.every(e => isOptional(e.cardinality))) {
            // secondly, try to find the next elements of the parent
            features.push(...findNextFeatures([parent]));
        }
        if (features.every(e => isOptional(e.cardinality))) {
            // lasty, climb the feature stack and calculate completion for previously called rules
            featureStack.shift();
            features.push(...findNextFeatures(featureStack));
        }
    } else {
        // Climb the feature stack if this feature is the only one in a rule
        featureStack.shift();
        features.push(...findNextFeatures(featureStack));
    }
    return features;
}

export function findFirstFeatures(feature: ast.AbstractElement | undefined): ast.AbstractElement[] {
    if (feature === undefined) {
        return [];
    } else if (ast.isGroup(feature)) {
        return findNextFeaturesInGroup(feature, 0)
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (ast.isAlternatives(feature)) {
        return feature.elements.flatMap(e => findFirstFeatures(e))
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (ast.isUnorderedGroup(feature)) {
        return [];
    } else if (ast.isAssignment(feature)) {
        return findFirstFeatures(feature.terminal)
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (ast.isAction(feature)) {
        return findNextFeatures([feature])
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (ast.isRuleCall(feature)) {
        if (ast.isParserRule(feature.rule.value)) {
            return findFirstFeatures(feature.rule.value.alternatives)
                .map(e => modifyCardinality(e, feature.cardinality));
        } else {
            return [feature];
        }
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
function modifyCardinality(feature: ast.AbstractElement, cardinality: Cardinality): ast.AbstractElement {
    if (isOptional(cardinality)) {
        if (isOptional(feature.cardinality)) {
            return feature;
        } else if (isArray(feature.cardinality)) {
            return { ...feature, cardinality: '*' };
        } else {
            return { ...feature, cardinality: '?' };
        }
    } else {
        return feature;
    }
}

function findNextFeaturesInGroup(group: ast.Group, index: number): ast.AbstractElement[] {
    const features: ast.AbstractElement[] = [];
    let firstFeature: ast.AbstractElement;
    do {
        firstFeature = group.elements[index++];
        features.push(...findFirstFeatures(firstFeature));
        if (!isOptional(firstFeature?.cardinality)) {
            break;
        }
    } while (firstFeature);
    return features;
}

export function buildContentAssistForRule(rule: ast.AbstractRule): string[] {
    if (ast.isTerminalRule(rule)) {
        return [rule.name];
    } else if (ast.isParserRule(rule)) {
        const features = findFirstFeatures(rule.alternatives);
        return features.flatMap(e => buildContentAssistFor(e));
    } else {
        return [];
    }
}

export function buildContentAssistFor(feature: ast.AbstractElement): string[] {
    if (ast.isKeyword(feature)) {
        return [feature.value.substring(1, feature.value.length - 1)];
    } else if (ast.isRuleCall(feature) && feature.rule.value) {
        return buildContentAssistForRule(feature.rule.value);
    } else if (ast.isCrossReference(feature)) {
        // TODO: Use scoping here
        return buildContentAssistFor(feature.terminal);
    }
    return [];
}