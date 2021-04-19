import { Grammar, ParserRule } from "../gen/ast";
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { collectAst } from "./type-collector";
import { collectRule } from "./utils";

export function generateAst2(grammar: Grammar, path?: string): string {
    const types = collectAst(grammar);
    const langiumPath = "'" + (path ?? "langium") + "'"
    const fileNode = new CompositeGeneratorNode();
    fileNode.children.push(
        new TextNode("/* eslint-disable @typescript-eslint/no-namespace */"),
        new NewLineNode(),
        new TextNode("/* eslint-disable @typescript-eslint/no-explicit-any */"),
        new NewLineNode(),
        new TextNode("/* eslint-disable @typescript-eslint/no-empty-interface */"),
        new NewLineNode(),
        new TextNode("/* eslint-disable @typescript-eslint/explicit-module-boundary-types */"),
        new NewLineNode(),
        new TextNode('import { AstNode, Kind } from '), langiumPath, ';',
        new NewLineNode(),
        new NewLineNode()
    );

    for (const type of types) {
        fileNode.children.push(type.toString(), new NewLineNode());
    }

    return process(fileNode);
}

export function generateAst(grammar: Grammar, path?: string): string {
    const node = new CompositeGeneratorNode();
    const langiumPath = "'" + (path ?? "langium") + "'"
    node.children.push(
        new TextNode("/* eslint-disable */"),
        new NewLineNode(),
        new TextNode("// @ts-nocheck"),
        new NewLineNode(),
        new TextNode('import { AstNode } from '), langiumPath, ';',
        new NewLineNode(),
        new NewLineNode()
    );

    grammar.rules?.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(e => {
        node.children.push(generateRuleType(e));
    });

    return process(node);
}

function generateRuleType(rule: ParserRule): GeneratorNode {
    const typeNode = new CompositeGeneratorNode();
    const { fields, rules, hasAction } = collectRule(rule);

    typeNode.children.push("export type ", rule.Name, " = ");

    if (fields.length === 0 && rules.length === 0) {
        typeNode.children.push('AstNode & { kind: "' + rule.Name + '" }');
    }

    if (rules.length > 0 && fields.length > 0 && !hasAction) {
        typeNode.children.push("(");
    }

    typeNode.children.push(rules.join(" | "));

    if (rules.length > 0 && fields.length > 0 && !hasAction) {
        typeNode.children.push(")");
    }

    if (fields.length > 0) {
        if (hasAction) {
            typeNode.children.push(" | AstNode");
        } else if (rules.length === 0) {
            typeNode.children.push("AstNode");
        }
        typeNode.children.push(new TextNode(" & {"), new NewLineNode());

        const indent = new IndentNode("    ");
        typeNode.children.push(indent);
        if (rules.length === 0 || hasAction) {
            fields.push({
                name: "container",
                array: false,
                optional: false,
                type: ["Any"]
            });
        }
        fields.forEach((e, i) => {
            const option = e.optional && !e.array ? "?" : "";
            const array = e.array ? "[]" : "";
            const comma = i < fields.length - 1 ? "," : "";
            indent.children.push(new TextNode(e.name + option + ": " + e.type + array + comma), new NewLineNode());
        });

        typeNode.children.push(new TextNode("}"));
    }

    typeNode.children.push(new NewLineNode(), new NewLineNode());

    return typeNode;
}