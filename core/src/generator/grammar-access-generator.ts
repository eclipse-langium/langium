import { Grammar, ParserRule } from "../gen/ast";
import { CompositeGeneratorNode, IndentNode, NewLineNode } from "./node/node";
import { process } from "./node/node-processor";
import { findAllFeatures } from "./utils";

export function generate(grammar: Grammar): string {
    const node = new CompositeGeneratorNode();

    node.children.push("import { GrammarAccess } from '../grammar/grammar-access'", new NewLineNode(), "import { Assignment, CrossReference, Keyword, RuleCall } from './ast'", new NewLineNode(), new NewLineNode());

    grammar.rules.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(e => {
        node.children.push(generateRuleAccess(e), new NewLineNode(), new NewLineNode());
    });

    node.children.push("export class ", grammar.Name + "GrammarAccess extends GrammarAccess {", new NewLineNode());

    const content = new IndentNode(4);

    grammar.rules.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(e => {
        content.children.push(e.Name, " = this.buildAccess<", e.Name, "RuleAccess>('", e.Name, "');", new NewLineNode());
    });

    node.children.push(content, "}");

    return process(node);
}

function generateRuleAccess(rule: ParserRule): CompositeGeneratorNode {

    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();

    node.children.push("type ", rule.Name + "RuleAccess = {", new NewLineNode());

    const indent = new IndentNode(4);
    Array.from(byName.entries()).forEach(e => {
        const [name, {kind}] = e;
        indent.children.push(name, ": ", kind, ";", new NewLineNode());
    });

    node.children.push(indent, "}");

    return node;
}