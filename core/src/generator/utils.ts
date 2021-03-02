import { Action, Alternative, Assignment, Group, ParenthesizedGroup, Rule, RuleCall } from "../bootstrap/ast";

export function collectRule(rule: Rule, withKind: boolean = false): { fields: Field[], rules: string[] } {
    const kindField: Field = {
        name: "kind",
        array: false,
        optional: false,
        type: ['"' + rule.name! + '"']
    }
    const fields: Field[][] = [];
    const rules: string[] = [];
    rule.alternatives?.forEach(e => {
        const altFields: Field[] = [];
        collectAlternative(e, false, altFields, rules);
        fields.push(altFields);
    });
    const consolidated = consolidateFields(withKind ? kindField : undefined, fields);
    return { fields: consolidated, rules };
}

function consolidateFields(kindField: Field | undefined, fields: Field[][]): Field[] {
    let first = true;
    const map = new Map<string, Field>();
    for (const fieldArray of fields) {
        for (const field of fieldArray) {
            if (!map.has(field.name)) {
                map.set(field.name, field);
            }
        }
        first = false;
    }
    if (map.size > 0) {
        const items: Field[] = [];
        if (kindField) {
            items.push(kindField);
        }
        items.push(...Array.from(map.values()).sort());
        return items;
    } else {
        return [];
    }
}

function collectAlternative(alternative: Alternative, optional: boolean, fields: Field[], rules: string[]) {
    collectGroup(alternative.group!, optional, fields, rules)
}

function collectGroup(group: Group, optional: boolean, fields: Field[], rules: string[]) {
    if (group.items!.length == 1 && group.items![0].kind == "rule-call") {
        rules.push(getRuleTarget(group.items![0]));
    } else {
        group.items?.filter(e => e.kind == "assignment").map(e => e as Assignment).forEach(e => {
            collectAssignment(e, optional, fields);
        });
        group.items?.filter(e => e.kind == "parenthesized-group").map(e => e as ParenthesizedGroup).forEach(e => {
            collectParenthesizedGroup(e, optional, fields, rules);
        });
        group.items?.filter(e => e.kind == "action").map(e => e as Action).forEach(e => {
            collectAction(e, optional, fields);
        });
    }
}

function collectAction(action: Action, optional: boolean, fields: Field[]) {
    if (action.variable) {
        fields.push({
            name: action.variable!,
            array: action.type == "+=",
            optional: optional,
            type: [action.name!]
        });
    }
}

function collectParenthesizedGroup(group: ParenthesizedGroup, optional: boolean, fields: Field[], rules: string[]) {
    const isOptional = optional || group.cardinality == "?" || group.cardinality == "*";
    group.alternatives?.forEach(e => {
        collectAlternative(e, isOptional, fields, rules);
    })
}

function collectAssignment(assignment: Assignment, optional: boolean, fields: Field[]) {
    const array = assignment.type == "+=";
    const isBoolean = assignment.type == "?=";
    const isOptional = optional || assignment.cardinality == "?";
    let name = assignment.name!;
    if (name.startsWith("^")) {
        name = name.substring(1);
    }
    if (isBoolean) {
        fields.push({
            name: name,
            array: false,
            optional: isOptional,
            type: ["boolean"]
        });
    } else {
        let targetType: string = "";
        let v = assignment.value!;
        if (v.kind == "keyword") {
            targetType = v.value!;
        } else if (v.kind == "cross-reference") {
            targetType = getRuleTarget(v.target!);
        } else if (v.kind == "rule-call") {
            targetType = getRuleTarget(v);
        } else if (v.kind == "parenthesized-assignable-element") {
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
    const rule = ruleCall.rule;
    if (!rule) {
        return "undefined";
    }
    return rule.returnType ?? rule.name!;
}

export type Field = {
    name: string,
    optional: boolean,
    array: boolean,
    type: string[]
}