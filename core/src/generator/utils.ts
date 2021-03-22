/* eslint-disable */
import { AbstractTerminal, AbstractToken, Action, Assignment, CrossReference, Group, ParenthesizedAssignableElement, ParenthesizedElement, ParserRule, RuleCall, UnorderedGroup } from "../gen/ast";
import { replaceTokens } from "./token-replacer";

export type Feature = AbstractToken | CrossReference | ParenthesizedAssignableElement | Group;
type FeatureValue = {
    getter: () => Feature;
    kind: "Keyword" | "RuleCall" | "Assignment" | "CrossReference" | "Action";
}

export function findAllFeatures(rule: ParserRule) : { byName: Map<string, FeatureValue>, byFeature: Map<Feature, string> } {
    const map = new Map<string, FeatureValue>();
    const featureMap = new Map<Feature, string>();
    if (rule.Alternatives.kind === "Alternatives") {
        rule.Alternatives.Elements.forEach((e, i) => {
            putFeatureInGroup(e, map, featureMap);

        });
    } else {
        putFeatureInGroup(rule.Alternatives, map, featureMap);
    }
    
    const newMap = new Map<string, FeatureValue>();
    for (const [key, value] of Array.from(map.entries())) {
        newMap.set(key.replace(/\^/g, ""), value);
    }
    const newFeatureMap = new Map<Feature, string>();
    for (const [key, value] of Array.from(featureMap.entries())) {
        newFeatureMap.set(key, value.replace(/\^/g, ""));
    }
    return { byName: newMap, byFeature: newFeatureMap };
}

function putFeatureInGroup(group: UnorderedGroup, byName: Map<string, FeatureValue>, byFeature: Map<Feature, string>) {
    if (group.kind === "UnorderedGroup") {
        group.Elements.forEach(e => {
            putFeatureInGroup(e, byName, byFeature);
        })
    } else {
        group.Elements.forEach((e, i) => {
            putFeature(e, i, undefined, () => e, byName, byFeature);
        })
    }
}

function putFeature(feature: Feature, index: number, previous: string | undefined, getter: () => Feature, byName: Map<string, FeatureValue>, byFeature: Map<Feature, string>) {
    if (feature.kind === "Assignment") {
        const fullName = (previous ?? "") + feature.Feature;
        byName.set(fullName, { getter, kind: "Assignment" });
        byFeature.set(feature, fullName);
        const next = () => {
            const assignment = <Assignment>getter();
            return assignment.Terminal;
        };
        putFeature(feature.Terminal, 0, fullName, next, byName, byFeature);
    } else if (feature.kind == "RuleCall") {
        const name = (previous ?? "") + feature.Rule.Name + "RuleCall";
        byName.set(name, { getter, kind: "RuleCall" });
        byFeature.set(feature, name);
    } else if (feature.kind == "CrossReference") {
        const name = (previous ?? "") + feature.Type.Name + "CrossReference";
        byName.set(name, { getter, kind: "CrossReference" });
        byFeature.set(feature, name);
    } else if (feature.kind == "Keyword") {
        const validName = replaceTokens(feature.Value) + "Keyword";
        byName.set(validName, { getter, kind: "Keyword" });
        byFeature.set(feature, validName);
    } else if (feature.kind == "Action") {
        const name = (previous ?? "") + feature.Feature! + "Action";
        byName.set(name, { getter, kind: "Action" });
        byFeature.set(feature, name);
    } else if (feature.kind == "ParenthesizedAssignableElement") {
        // todo this one
        feature.Alternatives.Elements.forEach((e, i) => {
            putFeature(e, i, previous, () => e, byName, byFeature);
        });
    } else if (feature.kind == "Group") {
        feature.Elements.forEach((e, i) => {
            if (e.kind == "ParenthesizedElement") {
                if (e.Alternatives.kind === "Alternatives") {
                    e.Alternatives.Elements.forEach((f, j) => {
                        putFeatureInGroup(f, byName, byFeature);
                    });
                } else {
                    putFeatureInGroup(e.Alternatives, byName, byFeature);
                }
            } else {
                putFeature(e, 0, previous, () => e, byName, byFeature);
            }
        })
    }
}

type RuleType = {
    rules: string[],
    fields: Field[],
    hasAction: boolean
}

let lastRuleCall: RuleCall | undefined;

export function collectRule(rule: ParserRule): RuleType {
    const kindField: Field = {
        name: "kind",
        array: false,
        optional: false,
        type: ['"' + rule.Name! + '"']
    }
    const fields: Field[][] = [];
    const rules: string[] = [];
    let hasAction: boolean = false;
    if (rule.Alternatives.kind === "Alternatives") {
        rule.Alternatives.Elements.forEach(e => {
            const altFields: Field[] = [];
            const item: RuleType = { fields: altFields, rules, hasAction: false };
            collectAlternative(e, false, item);
            if (item.hasAction) {
                hasAction = true;
            }
            fields.push(altFields);
        });
    } else {
        const altFields: Field[] = [];
        const item: RuleType = { fields: altFields, rules, hasAction: false };
        collectAlternative(rule.Alternatives, false, item);
        if (item.hasAction) {
            hasAction = true;
        }
        fields.push(altFields);
    }
    
    const consolidated = consolidateFields(rules.length === 0 || hasAction ? kindField : undefined, fields);
    return { fields: consolidated, rules, hasAction };
}

function consolidateFields(kindField: Field | undefined, fields: Field[][]): Field[] {
    const map = new Map<string, Field>();
    for (const fieldArray of fields) {
        for (const field of fieldArray) {
            if (!map.has(field.name)) {
                map.set(field.name, field);
            }
        }
    }
    if (map.size > 0) {
        const items: Field[] = [];
        if (kindField) {
            items.push(kindField);
        }
        items.push(...Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
        return items;
    } else {
        return [];
    }
}

function collectAlternative(unorderedGroup: UnorderedGroup, optional: boolean, ruleType: RuleType) {
    if (unorderedGroup.kind === "UnorderedGroup") {
        unorderedGroup.Elements.forEach(e => {
            collectGroup(e, optional, ruleType);
        });
    } else {
        collectGroup(unorderedGroup, optional, ruleType);
    }
}

function collectGroup(group: Group, optional: boolean, ruleType: RuleType) {
    group.Elements.forEach(e => {
        if (e.kind == "Action") {
            ruleType.hasAction = true;
            collectAction(e, optional, ruleType.fields);
        } else if (e.kind == "Assignment") {
            collectAssignment(e, optional || isOptional(e.Cardinality), ruleType.fields);
        } else {
            collectTerminal(e, optional || isOptional(e.Cardinality), ruleType);
        }
    });
}

function collectAction(action: Action, optional: boolean, fields: Field[]) {
    if (action.Feature) {
        fields.push({
            name: action.Feature!,
            array: action.Operator == "+=",
            optional: optional,
            type: [lastRuleCall!.Rule.Name]
        });
    }
}

function collectTerminal(terminal: AbstractTerminal, optional: boolean, ruleType: RuleType) {
    if (terminal.kind == "ParenthesizedElement") {
        collectParenthesizedGroup(terminal, optional, ruleType);
    } else if (terminal.kind == "RuleCall") {
        lastRuleCall = terminal;
        ruleType.rules.push(terminal.Rule.Name);
    }
}

function isOptional(cardinality: string | undefined) {
    return cardinality && cardinality == "?" || cardinality == "*";
}

function collectParenthesizedGroup(group: ParenthesizedElement, optional: boolean, ruleType: RuleType) {
    if (group.Alternatives.kind === "Alternatives") {
        group.Alternatives.Elements.forEach(e => {
            collectAlternative(e, optional, ruleType);
        })
    } else {
        collectAlternative(group.Alternatives, optional, ruleType);
    }
}

function collectAssignment(assignment: Assignment, optional: boolean, fields: Field[]) {
    const array = assignment.Operator == "+=";
    const isBoolean = assignment.Operator == "?=";
    let name = assignment.Feature;
    if (name.startsWith("^")) {
        name = name.substring(1);
    }
    if (isBoolean) {
        fields.push({
            name: name,
            array: false,
            optional,
            type: ["boolean"]
        });
    } else {
        let targetType: string = "";
        let v = assignment.Terminal;
        if (v.kind == "Keyword") {
            targetType = v.Value;
        } else if (v.kind == "RuleCall") {
            targetType = getRuleTarget(v);
        } else if (v.kind == "CrossReference") {
            targetType = v.Type.Name;
        } else if (v.kind == "ParenthesizedAssignableElement") {
            targetType = "string";
        }
        fields.push({
            name: name,
            array,
            optional,
            type: [targetType]
        })
    }
}

function getRuleTarget(ruleCall: RuleCall): string {
    const rule = ruleCall.Rule;
    if (!rule) {
        return "undefined";
    }
    return rule.Type ?? rule.Name;
}

export type Field = {
    name: string,
    optional: boolean,
    array: boolean,
    type: string[]
}