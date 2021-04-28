import { AbstractElement, AbstractRule, Alternatives, Assignment, CrossReference, Group, Keyword, ParserRule, RuleCall, TerminalRule, UnorderedGroup } from '../../gen/ast';
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
        if (parent) {
            const ownIndex = parent.elements.indexOf(item);
            let cont = true;
            if (ownIndex !== undefined && ownIndex < parent.elements.length - 1) {
                features.push(...this.findNextFeatureInGroup(parent, ownIndex + 1));
                cont = !features.some(e => !isOptional(e.cardinality));
            }
            // cont = true assumes we are at the end of the current group
            if (cont) {
                // first try iterating the same group again
                if (isArray(parent.cardinality)) {
                    features.push(...this.findFirstFeatures(parent));
                }
                // secondly, try to find the next elements of the parent
                if (AbstractElement.is(parent)) {
                    features.push(...this.findNextFeatures([parent]));
                }
                // lasty, climb the feature stack and calculate completion for previously called rules
                featureStack.pop();
                features.push(...this.findNextFeatures(featureStack));
            }
        } else {
            // Climb the feature stack if this feature is the only one in a rule
            featureStack.pop();
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
        } else {
            return [feature];
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
            return [feature.value];
        } else if (RuleCall.is(feature) && feature.rule.value) {
            return this.buildContentAssistForRule(feature.rule.value);
        } else if (CrossReference.is(feature)) {
            // TODO: Use scoping here
            return this.buildContentAssistFor(feature.terminal);
        }
        return [];
    }

}