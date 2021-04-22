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

function putFeature(element: AbstractElement, previous: string | undefined, byName: Map<string, FeatureValue>, byFeature: Map<AbstractElement, string>) {
    if (Assignment.is(element)) {
        const fullName = (previous ?? "") + element.feature;
        byName.set(fullName, { feature: element, kind: "Assignment" });
        byFeature.set(element, fullName);
        putFeature(element.terminal, fullName, byName, byFeature);
    } else if (RuleCall.is(element)) {
        const name = (previous ?? "") + element.rule.name + "RuleCall";
        byName.set(name, { feature: element, kind: "RuleCall" });
        byFeature.set(element, name);
    } else if (CrossReference.is(element)) {
        const name = (previous ?? "") + element.type.name + "CrossReference";
        byName.set(name, { feature: element, kind: "CrossReference" });
        byFeature.set(element, name);
    } else if (Keyword.is(element)) {
        const validName = replaceTokens(element.value) + "Keyword";
        byName.set(validName, { feature: element, kind: "Keyword" });
        byFeature.set(element, validName);
    } else if (Action.is(element)) {
        const name = (previous ?? "") + element.Type + (element.feature ?? "") + "Action";
        byName.set(name, { feature: element, kind: "Action" });
        byFeature.set(element, name);
    } else if (Alternatives.is(element) || UnorderedGroup.is(element) || Group.is(element)) {
        for (const subFeature of element.elements) {
            putFeature(subFeature, previous, byName, byFeature);
        }
    }
}