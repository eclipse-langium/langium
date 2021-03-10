import { Grammar, ParserRule } from "../gen/ast";
import { CompositeGeneratorNode, IGeneratorNode, IndentNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { collectRule } from "./utils";

export function generateAst(grammar: Grammar): string {
    const node = new CompositeGeneratorNode();

    node.children.push(new TextNode('import { AstNode } from "../generator/ast-node"'), new NewLineNode(), new NewLineNode());

    grammar.rules?.filter(e => e.kind == "ParserRule").map(e => e as ParserRule).forEach(e => {
        node.children.push(generateRuleType(e));
    });

    return process(node);
}

function generateRuleType(rule: ParserRule): IGeneratorNode {
    const typeNode = new CompositeGeneratorNode();
    const { fields, rules } = collectRule(rule, true);

    typeNode.children.push(new TextNode("export type "), new TextNode(rule.Name), new TextNode(" = "));

    if (fields.length == 0 && rules.length == 0) {
        typeNode.children.push(new TextNode('{ kind: "' + rule.Name + '" }'));
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