/* eslint-disable */
import { AbstractTerminal, Action, Assignment, CrossReference, Group, Keyword, ParenthesizedAssignableElement, ParenthesizedElement, ParserRule, RuleCall, UnorderedGroup } from "../gen/ast";
import { replaceTokens } from "./token-replacer";

export type Feature = Keyword | RuleCall | Assignment | CrossReference | ParenthesizedAssignableElement | Group;
type FeatureValue = {
    getter: () => Feature;
    kind: "Keyword" | "RuleCall" | "Assignment" | "CrossReference";
}

export function findAllFeatures(rule: ParserRule) : { byName: Map<string, FeatureValue>, byFeature: Map<Feature, string> } {
    const map = new Map<string, FeatureValue>();
    const featureMap = new Map<Feature, string>();
    rule.Alternatives.Elements.forEach((e, i) => {
        e.Elements.forEach((f, j) => {
            putFeature(f, j, undefined, () => rule.Alternatives.Elements[i].Elements[j], map, featureMap);
        });
    });
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
    } else if (feature.kind == "ParenthesizedAssignableElement") {
        // todo this one
        feature.Alternatives.Elements.forEach((e, i) => {
            putFeature(e, i, previous, () => e, byName, byFeature);
        });
    } else if (feature.kind == "Group") {
        feature.Elements.forEach((e, i) => {
            if (e.kind == "AbstractTokenWithCardinality") {
                if (e.Assignment) {
                    putFeature(e.Assignment, 0, previous, () => {
                        return e.Assignment;
                    }, byName, byFeature);
                } else if (e.Terminal) {
                    if (e.Terminal.kind == "Keyword") {
                        const keyword = e.Terminal;
                        putFeature(keyword, 0, previous, () => keyword, byName, byFeature);
                    } else if (e.Terminal.kind == "RuleCall") {
                        const ruleCall = e.Terminal;
                        putFeature(ruleCall, 0, previous, () => ruleCall, byName, byFeature);
                    } else if (e.Terminal.kind == "ParenthesizedElement") {
                        const element = e.Terminal;
                        element.Alternatives.Elements.forEach((e) => {
                            e.Elements.forEach((f, j) => {
                                putFeature(f, j, previous, () => f, byName, byFeature);
                            });
                        });
                    }
                }
            }
        })
    }
}


export function collectRule(rule: ParserRule, withKind: boolean = false): { fields: Field[], rules: string[] } {
    const kindField: Field = {
        name: "kind",
        array: false,
        optional: false,
        type: ['"' + rule.Name! + '"']
    }
    const fields: Field[][] = [];
    const rules: string[] = [];
    rule.Alternatives.Elements.forEach(e => {
        const altFields: Field[] = [];
        collectAlternative(e, false, altFields, rules);
        fields.push(altFields);
    });
    const consolidated = consolidateFields(withKind ? kindField : undefined, fields);
    return { fields: consolidated, rules };
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

function collectAlternative(unorderedGroup: UnorderedGroup, optional: boolean, fields: Field[], rules: string[]) {
    unorderedGroup.Elements.forEach(e => {
        collectGroup(e, optional, fields, rules);
    });
}

function collectGroup(group: Group, optional: boolean, fields: Field[], rules: string[]) {
    const singleRule = singleRuleCall(group);
    if (singleRule) {
        rules.push(singleRule);
    } else {
        group.Elements.forEach(e => {
            if (e.kind == "AbstractTokenWithCardinality") {
                if (e.Assignment) {
                    collectAssignment(e.Assignment, optional || isOptional(e.Cardinality), fields);
                }
                if (e.Terminal) {
                    collectTerminal(e.Terminal, optional || isOptional(e.Cardinality), fields, rules);
                }
            } else if (e.kind == "Action") {
                collectAction(e, optional, fields);
            }
        })
    }
}

function singleRuleCall(group: Group): string | undefined {
    if (group.Elements.length == 1 && group.Elements[0].kind == "AbstractTokenWithCardinality") {
        const e = group.Elements[0];
        if (e.Terminal && e.Terminal.kind == "RuleCall") {
            return e.Terminal.Rule.Name;
        }
    }
    return undefined;
}

function collectAction(action: Action, optional: boolean, fields: Field[]) {
    if (action.Feature) {
        fields.push({
            name: action.Feature!,
            array: action.Operator == "+=",
            optional: optional,
            type: [action.Type.Name]
        });
    }
}

function collectTerminal(terminal: AbstractTerminal, optional: boolean, fields: Field[], rules: string[]) {
    if (terminal.kind == "ParenthesizedElement") {
        collectParenthesizedGroup(terminal, optional, fields, rules);
    }
}

function isOptional(cardinality: string | undefined) {
    return cardinality && cardinality == "?" || cardinality == "*";
}

function collectParenthesizedGroup(group: ParenthesizedElement, optional: boolean, fields: Field[], rules: string[]) {
    group.Alternatives.Elements.forEach(e => {
        collectAlternative(e, optional, fields, rules);
    })
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