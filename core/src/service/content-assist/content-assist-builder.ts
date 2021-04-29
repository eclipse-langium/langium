import { AbstractElement, AbstractRule, Action, Alternatives, Assignment, CrossReference, Group, Keyword, ParserRule, RuleCall, TerminalRule, UnorderedGroup } from '../../gen/ast';
import { Cardinality, isArray, isOptional } from '../../generator/utils';

export function findNextFeatures(featureStack: AbstractElement[]): AbstractElement[] {
    if (featureStack.length === 0) {
        return [];
    }
    const features: AbstractElement[] = [];
    const feature = featureStack[0];
    let parent: Group | undefined;
    let item = feature;
    while (item.container) {
        if (Group.is(item.container)) {
            parent = item.container;
            break;
        } else if (AbstractElement.is(item.container)) {
            item = item.container;
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

export function findFirstFeatures(feature: AbstractElement | undefined): AbstractElement[] {
    if (feature === undefined) {
        return [];
    } else if (Group.is(feature)) {
        return findNextFeaturesInGroup(feature, 0)
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (Alternatives.is(feature)) {
        return feature.elements.flatMap(e => findFirstFeatures(e))
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (UnorderedGroup.is(feature)) {
        return [];
    } else if (Assignment.is(feature)) {
        return findFirstFeatures(feature.terminal)
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (Action.is(feature)) {
        return findNextFeatures([feature])
            .map(e => modifyCardinality(e, feature.cardinality));
    } else if (RuleCall.is(feature)) {
        if (ParserRule.is(feature.rule.value)) {
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
function modifyCardinality(feature: AbstractElement, cardinality: Cardinality): AbstractElement {
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

function findNextFeaturesInGroup(group: Group, index: number): AbstractElement[] {
    const features: AbstractElement[] = [];
    let firstFeature: AbstractElement;
    do {
        firstFeature = group.elements[index++];
        features.push(...findFirstFeatures(firstFeature));
        if (!isOptional(firstFeature?.cardinality)) {
            break;
        }
    } while (firstFeature);
    return features;
}

export function buildContentAssistForRule(rule: AbstractRule): string[] {
    if (TerminalRule.is(rule)) {
        return [rule.name];
    } else if (ParserRule.is(rule)) {
        const features = findFirstFeatures(rule.alternatives);
        return features.flatMap(e => buildContentAssistFor(e));
    } else {
        return [];
    }
}

export function buildContentAssistFor(feature: AbstractElement): string[] {
    if (Keyword.is(feature)) {
        return [feature.value.substring(1, feature.value.length - 1)];
    } else if (RuleCall.is(feature) && feature.rule.value) {
        return buildContentAssistForRule(feature.rule.value);
    } else if (CrossReference.is(feature)) {
        // TODO: Use scoping here
        return buildContentAssistFor(feature.terminal);
    }
    return [];
}