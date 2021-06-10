import * as ast from '../grammar/generated/ast';
import { Cardinality, isArray, isOptional } from '../grammar/grammar-util';

export class FollowElementComputation {

    findNextFeatures(featureStack: ast.AbstractElement[]): ast.AbstractElement[] {
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
            features.push(...this.findFirstFeatures(item));
        }
        if (parent) {
            const ownIndex = parent.elements.indexOf(item);
            // Find next elements of the same group
            if (ownIndex !== undefined && ownIndex < parent.elements.length - 1) {
                features.push(...this.findNextFeaturesInGroup(parent, ownIndex + 1));
            }
            if (features.every(e => isOptional(e.cardinality))) {
                // secondly, try to find the next elements of the parent
                features.push(...this.findNextFeatures([parent]));
            }
            if (features.every(e => isOptional(e.cardinality))) {
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

    findFirstFeatures(feature: ast.AbstractElement | undefined): ast.AbstractElement[] {
        if (feature === undefined) {
            return [];
        } else if (ast.isGroup(feature)) {
            return this.findNextFeaturesInGroup(feature, 0)
                .map(e => this.modifyCardinality(e, feature.cardinality));
        } else if (ast.isAlternatives(feature)) {
            return feature.elements.flatMap(e => this.findFirstFeatures(e))
                .map(e => this.modifyCardinality(e, feature.cardinality));
        } else if (ast.isUnorderedGroup(feature)) {
            return [];
        } else if (ast.isAssignment(feature)) {
            return this.findFirstFeatures(feature.terminal)
                .map(e => this.modifyCardinality(e, feature.cardinality));
        } else if (ast.isAction(feature)) {
            return this.findNextFeatures([feature])
                .map(e => this.modifyCardinality(e, feature.cardinality));
        } else if (ast.isRuleCall(feature)) {
            if (ast.isParserRule(feature.rule.ref)) {
                return this.findFirstFeatures(feature.rule.ref.alternatives)
                    .map(e => this.modifyCardinality(e, feature.cardinality));
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
    protected modifyCardinality(feature: ast.AbstractElement, cardinality: Cardinality): ast.AbstractElement {
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

    findNextFeaturesInGroup(group: ast.Group, index: number): ast.AbstractElement[] {
        const features: ast.AbstractElement[] = [];
        let firstFeature: ast.AbstractElement;
        do {
            firstFeature = group.elements[index++];
            features.push(...this.findFirstFeatures(firstFeature));
            if (!isOptional(firstFeature?.cardinality)) {
                break;
            }
        } while (firstFeature);
        return features;
    }

}