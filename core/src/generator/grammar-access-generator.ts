import { Grammar, ParserRule } from "../gen/ast";
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode } from "./node/node";
import { process } from "./node/node-processor";
import { Feature, findAllFeatures } from "./utils";

export function generateGrammarAccess(grammar: Grammar, path?: string, bootstrap = false): string {
    const node = new CompositeGeneratorNode();

    const langiumPath = "'" + (path ?? "langium") + "'";
    node.children.push("import { GrammarAccess } from ", langiumPath, new NewLineNode(), "import { Action, Assignment, CrossReference, Keyword, RuleCall } from './ast'", new NewLineNode(), new NewLineNode());

    grammar.rules.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(e => {
        node.children.push(generateRuleAccess(e), new NewLineNode(), new NewLineNode());
    });

    node.children.push("export class ", grammar.Name + "GrammarAccess extends GrammarAccess {", new NewLineNode());

    const content = new IndentNode(4);

    grammar.rules.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(e => {
        if (bootstrap) {
            content.children.push(e.Name, generateBootstrapRuleAccess(e), new NewLineNode());
        } else {
            content.children.push(e.Name, " = this.buildAccess<", e.Name, "RuleAccess>('", e.Name, "');", new NewLineNode());
        }
    });

    node.children.push(content, "}");

    return process(node);
}

function generateBootstrapRuleAccess(rule: ParserRule): GeneratorNode {
    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();
    node.children.push(": ", rule.Name, "RuleAccess = <", rule.Name, "RuleAccess><unknown>{", new NewLineNode());
    const indent = new IndentNode(4);
    node.children.push(indent);
    Array.from(byName.entries()).forEach(e => {
        const [name, feature] = e;
        indent.children.push(name, ": ", generateFeature(feature.getter()), new NewLineNode());
    });

    node.children.push("}");
    return node;
}

function generateFeature(feature: Feature): GeneratorNode {
    const node = new CompositeGeneratorNode();
    node.children.push("{", new NewLineNode());

    const indent = new IndentNode(4);
    node.children.push(indent);
    if (feature.kind === "Assignment") {
        indent.children.push("kind: 'Assignment',", new NewLineNode());
        indent.children.push("Feature: '", feature.Feature ,"',", new NewLineNode());
        indent.children.push("Operator: '", feature.Operator, "',", new NewLineNode());
        indent.children.push("Terminal: {", new NewLineNode());
        const terminal = new IndentNode(4);
        if (feature.Terminal.kind === "CrossReference") {
            terminal.children.push("kind: 'CrossReference'");
        } else {
            terminal.children.push("kind: 'unknown'");
        }
        indent.children.push(terminal, new NewLineNode(), "}", new NewLineNode());
    } else if (feature.kind === "Action") {
        indent.children.push("kind: 'Action',", new NewLineNode());
        indent.children.push("Feature: '" + feature.Feature + "',", new NewLineNode());
        indent.children.push("Operator: '" + feature.Operator + "'", new NewLineNode());
    } else {
        indent.children.push("kind: 'unknown'" , new NewLineNode());
    }

    node.children.push("},");
    return node;
}

function generateRuleAccess(rule: ParserRule): CompositeGeneratorNode {

    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();

    node.children.push("export type ", rule.Name + "RuleAccess = {", new NewLineNode());

    const indent = new IndentNode(4);
    Array.from(byName.entries()).forEach(e => {
        const [name, {kind}] = e;
        indent.children.push(name, ": ", kind, ";", new NewLineNode());
    });

    node.children.push(indent, "}");

    return node;
}