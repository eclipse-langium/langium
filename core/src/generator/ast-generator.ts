import { Grammar, ParserRule } from "../gen/ast";
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { collectRule } from "./utils";

export function generateAst(grammar: Grammar): string {
    const node = new CompositeGeneratorNode();

    node.children.push(
        new TextNode("/* eslint-disable */"),
        new NewLineNode(),
        new TextNode("// @ts-nocheck"),
        new NewLineNode(),
        new TextNode('import { AstNode } from "../generator/ast-node"'),
        new NewLineNode(),
        new NewLineNode()
    );

    node.children.push("export type Any = ", grammar.rules?.filter(e => e.kind === "ParserRule").map(e => e.Name).join(" | "), ";", new NewLineNode(), new NewLineNode());

    grammar.rules?.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(e => {
        node.children.push(generateRuleType(e));
    });

    return process(node);
}

function generateRuleType(rule: ParserRule): GeneratorNode {
    const typeNode = new CompositeGeneratorNode();
    const { fields, rules } = collectRule(rule, true);

    typeNode.children.push(new TextNode("export type "), new TextNode(rule.Name), new TextNode(" = "));

    if (fields.length === 0 && rules.length === 0) {
        typeNode.children.push(new TextNode('AstNode & { kind: "' + rule.Name + '" }'));
    }

    rules.forEach(e => {
        typeNode.children.push(new TextNode(e), new TextNode(" | "));
    });

    if (fields.length > 0) {
        typeNode.children.push(new TextNode("AstNode & {"), new NewLineNode());

        const indent = new IndentNode("    ");
        typeNode.children.push(indent);
        fields.push({
            name: "container",
            array: false,
            optional: false,
            type: ["Any"]
        });
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