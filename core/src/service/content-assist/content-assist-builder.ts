import { AbstractElement, AbstractRule, Action, Alternatives, Assignment, CrossReference, Group, Keyword, ParserRule, RuleCall, TerminalRule, UnorderedGroup } from '../../gen/ast';
import { isArray, isOptional } from '../../generator/utils';

export class ContentAssistBuilder {

    findNextFeatures(featureStack: AbstractElement[]): AbstractElement[] {
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
        // first try iterating the same group again
        if (isArray(item.cardinality)) {
            features.push(...this.findFirstFeatures(item));
        }
        if (parent) {
            const ownIndex = parent.elements.indexOf(item);
            const definedParent = parent;
            if (ownIndex !== undefined && ownIndex < parent.elements.length - 1) {
                features.push(...this.findNextFeatureInGroup(parent, ownIndex + 1));
            }
            if (features.every(e => this.isOptionalNextFeature(e, definedParent))) {
                // secondly, try to find the next elements of the parent
                features.push(...this.findNextFeatures([parent]));
            }
            if (features.every(e => this.isOptionalNextFeature(e, definedParent))) {
                // lasty, climb the feature stack and calculate completion for previously called rules
                featureStack.shift();
                features.push(...this.findNextFeatures(featureStack));
            }
        } else {
            // Climb the feature stack if this feature is the only one in a rule
            featureStack.shift();
            features.push(...this.findNextFeatures(featureStack));
        }
        return features;
    }

    findFirstFeatures(feature: AbstractElement | undefined): AbstractElement[] {
        if (feature === undefined) {
            return [];
        } else if (Group.is(feature)) {
            return this.findNextFeatureInGroup(feature, 0);
        } else if (Alternatives.is(feature)) {
            return feature.elements.flatMap(e => this.findFirstFeatures(e));
        } else if (UnorderedGroup.is(feature)) {
            return [];
        } else if (Assignment.is(feature)) {
            return this.findFirstFeatures(feature.terminal);
        } else if (Action.is(feature)) {
            return this.findNextFeatures([feature]);
        } else {
            return [feature];
        }
    }

    private isOptionalNextFeature(feature: AbstractElement, parent: Group): boolean {
        if (feature === parent) {
            return false;
        } else {
            return isOptional(feature.cardinality) || (AbstractElement.is(feature.container) && this.isOptionalNextFeature(feature.container, parent));
        }
    }

    private findNextFeatureInGroup(group: Group, index: number): AbstractElement[] {
        const features: AbstractElement[] = [];
        let firstFeature: AbstractElement;
        do {
            firstFeature = group.elements[index++];
            features.push(...this.findFirstFeatures(firstFeature));
            if (!isOptional(firstFeature?.cardinality)) {
                break;
            }
        } while (firstFeature);
        return features;
    }

    buildContentAssistForRule(rule: AbstractRule): string[] {
        if (TerminalRule.is(rule)) {
            return [rule.name];
        } else if (ParserRule.is(rule)) {
            const features = this.findFirstFeatures(rule.alternatives);
            return features.flatMap(e => this.buildContentAssistFor(e));
        } else {
            return [];
        }
    }

    buildContentAssistFor(feature: AbstractElement): string[] {
        if (Keyword.is(feature)) {
            return [feature.value.substring(1, feature.value.length - 1)];
        } else if (RuleCall.is(feature) && feature.rule.value) {
            return this.buildContentAssistForRule(feature.rule.value);
        } else if (CrossReference.is(feature)) {
            // TODO: Use scoping here
            return this.buildContentAssistFor(feature.terminal);
        }
        return [];
    }
}