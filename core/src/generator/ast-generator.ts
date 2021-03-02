import { Action, Alternative, Assignment, Grammar, Group, ParenthesizedGroup, Rule, RuleCall } from "../bootstrap/ast";
import { CompositeGeneratorNode, IGeneratorNode, IndentNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { collectRule } from "./utils";

export function generateAst(grammar: Grammar): string {
    const node = new CompositeGeneratorNode();

    node.children.push(new TextNode('import { AstNode } from "../generator/ast-node"'), new NewLineNode(), new NewLineNode());

    grammar.rules?.filter(e => e.kind == "rule").map(e => e as Rule).forEach(e => {
        node.children.push(generateRuleType(e));
    });

    return process(node);
}

function generateRuleType(rule: Rule): IGeneratorNode {
    const typeNode = new CompositeGeneratorNode();
    const { fields, rules } = collectRule(rule, true);

    typeNode.children.push(new TextNode("export type "), new TextNode(rule.name!), new TextNode(" = "));

    if (fields.length == 0 && rules.length == 0) {
        typeNode.children.push(new TextNode('{ kind: "' + rule.name! + '" }'));
    }

    rules.forEach(e => {
        typeNode.children.push(new TextNode(e), new TextNode(" | "));
    });

    if (fields.length > 0) {
        typeNode.children.push(new TextNode("AstNode & {"), new NewLineNode());

        const indent = new IndentNode("    ");
        typeNode.children.push(indent);
        fields.forEach((e, i) => {
            const option = e.optional && !e.array ? "?" : "";
            const array = e.array ? "[]" : "";
            const comma = i < fields.length - 1 ? "," : "";
            indent.children.push(new TextNode(e.name + option + ": " + e.type + array + comma), new NewLineNode());
        });

        typeNode.children.push(new TextNode("}"));
    } else if (rules.length > 0) {
        typeNode.children.pop();
    }

    typeNode.children.push(new NewLineNode(), new NewLineNode());

    return typeNode;
}

function generateAlternative(alternative: Alternative, optional: boolean, wrap: boolean, fields: Field[]): CompositeGeneratorNode {
    const altNode = new CompositeGeneratorNode();

    altNode.children.push(generateGroup(alternative.group!, optional, wrap, fields));

    return altNode;
}

function generateGroup(group: Group, optional: boolean, wrap: boolean, fields: Field[]): IGeneratorNode {
    const node = new CompositeGeneratorNode();

    if (group.items!.length == 1 && group.items![0].kind == "rule-call") {
        return new TextNode(getRuleTarget(group.items![0]));
    } else {
        if (wrap) {
            node.children.push(new TextNode("AstNode & {"), new NewLineNode());
        }
        
        group.items?.filter(e => e.kind == "assignment").map(e => e as Assignment).forEach(e => {
            generateAssignment(e, optional, fields);
        });
        group.items?.filter(e => e.kind == "parenthesized-group").map(e => e as ParenthesizedGroup).forEach(e => {
            generateParenthesizedGroup(e, optional, fields);
        });
        group.items?.filter(e => e.kind == "action").map(e => e as Action).forEach(e => {
            generateAction(e, optional, fields);
        });

        if (wrap) {

            const set = new Set<string>();

            const indent = new IndentNode("    ");
            node.children.push(indent);

            fields.forEach((e, i) => {
                if (!set.has(e.name)) {
                    set.add(e.name);
                    const option = e.optional && !e.array && e.type !== "boolean" ? "?" : "";
                    const array = e.array ? "[]" : "";
                    const comma = i < fields.length - 1 ? "," : "";
                    indent.children.push(new TextNode(e.name + option + ": " + e.type + array + comma), new NewLineNode());
                }
            });

            node.children.push(new TextNode("}"));
        }
    }

    return node;
}

function generateAction(action: Action, optional: boolean, fields: Field[]) {
    if (action.variable) {
        fields.push({
            name: action.variable!,
            array: action.type == "+=",
            optional: optional,
            type: action.name!
        });
    }
}

function generateParenthesizedGroup(group: ParenthesizedGroup, optional: boolean, fields: Field[]) {
    const isOptional = optional || group.cardinality == "?" || group.cardinality == "*";
    group.alternatives?.forEach(e => {
        generateAlternative(e, isOptional, false, fields);
    })
}

function generateAssignment(assignment: Assignment, optional: boolean, fields: Field[]) {
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
            type: "boolean"
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
            type: targetType
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

type Field = {
    name: string,
    optional: boolean,
    array: boolean,
    type: string
}