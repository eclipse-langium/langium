/* eslint-disable */
import { AbstractElement, Action, Alternatives, Assignment, CrossReference, Group, Keyword, ParserRule, RuleCall, UnorderedGroup } from "../gen/ast";
import { replaceTokens } from "./token-replacer";

type FeatureValue = {
    feature: AbstractElement;
    kind: "Keyword" | "RuleCall" | "Assignment" | "CrossReference" | "Action";
}

export type Cardinality = "?" | "*" | "+" | undefined;

export function isOptionalCardinality(cardinality?: Cardinality): boolean {
    return cardinality === "?" || cardinality === "*";
}

export function isDataTypeRule(rule: ParserRule): boolean {
    const features = Array.from(findAllFeatures(rule).byFeature.keys());
    const onlyRuleCallsAndKeywords = features.every(e => RuleCall.is(e) || Keyword.is(e) || Group.is(e) || Alternatives.is(e) || UnorderedGroup.is(e));
    if (onlyRuleCallsAndKeywords) {
        const ruleCallWithParserRule = features.filter(e => RuleCall.is(e) && ParserRule.is(e.rule) && !isDataTypeRule(e.rule));
        return ruleCallWithParserRule.length === 0;
    }
    return false;
}

export function findAllFeatures(rule: ParserRule) : { byName: Map<string, FeatureValue>, byFeature: Map<AbstractElement, string> } {
    const map = new Map<string, FeatureValue>();
    const featureMap = new Map<AbstractElement, string>();
    putFeature(rule.alternatives, undefined, map, featureMap);
    
    const newMap = new Map<string, FeatureValue>();
    for (const [key, value] of Array.from(map.entries())) {
        newMap.set(key.replace(/\^/g, ""), value);
    }
    const newFeatureMap = new Map<AbstractElement, string>();
    for (const [key, value] of Array.from(featureMap.entries())) {
        newFeatureMap.set(key, value.replace(/\^/g, ""));
    }
    return { byName: newMap, byFeature: newFeatureMap };
}

function putFeature(feature: AbstractElement, previous: string | undefined, byName: Map<string, FeatureValue>, byFeature: Map<AbstractElement, string>) {
    if (Assignment.is(feature)) {
        const fullName = (previous ?? "") + feature.feature;
        byName.set(fullName, { feature, kind: "Assignment" });
        byFeature.set(feature, fullName);
        putFeature(feature.terminal, fullName, byName, byFeature);
    } else if (RuleCall.is(feature)) {
        const name = (previous ?? "") + feature.rule.name + "RuleCall";
        byName.set(name, { feature, kind: "RuleCall" });
        byFeature.set(feature, name);
    } else if (CrossReference.is(feature)) {
        const name = (previous ?? "") + feature.type.name + "CrossReference";
        byName.set(name, { feature, kind: "CrossReference" });
        byFeature.set(feature, name);
    } else if (Keyword.is(feature)) {
        const validName = replaceTokens(feature.value) + "Keyword";
        byName.set(validName, { feature, kind: "Keyword" });
        byFeature.set(feature, validName);
    } else if (Action.is(feature)) {
        const name = (previous ?? "") + feature.Type + (feature.feature ?? "") + "Action";
        byName.set(name, { feature, kind: "Action" });
        byFeature.set(feature, name);
    } else if (Alternatives.is(feature) || UnorderedGroup.is(feature) || Group.is(feature)) {
        feature.elements.forEach(f => {
            putFeature(f, previous, byName, byFeature);
        });
    }
}