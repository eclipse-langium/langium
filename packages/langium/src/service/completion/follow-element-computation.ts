import * as ast from '../../grammar/generated/ast';
import { Cardinality, isArray, isOptional } from '../../grammar/grammar-util';

/**
 * Calculates any features that can follow the given feature stack.
 * This also includes features following optional features and features from previously called rules that could follow the last feature.
 * @param featureStack A stack of features starting at the entry rule and ending at the feature of the current cursor position.
 * @returns Any `AbstractElement` that could be following the given feature stack.
 */
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

/**
 * Calculates the first child feature of any `AbstractElement`.
 * @param feature The `AbstractElement` whose first child features should be calculated.
 * @returns A list of features that could be the first feature of the given `AbstractElement`.
 * These features contain a modified `cardinality` property. If the given `feature` is optional, the returned features will be optional as well.
 */
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
        // TODO: Do we want to continue supporting unordered groups?
        return [];
    } else if (ast.isAssignment(feature)) {
        return findFirstFeatures(feature.terminal)
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (ast.isAction(feature)) {
        return findNextFeatures([feature])
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (ast.isRuleCall(feature) && ast.isParserRule(feature.rule.ref)) {
        return findFirstFeatures(feature.rule.ref.alternatives)
            .map(e => modifyCardinality(e, feature.cardinality));
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