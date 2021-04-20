import { AbstractElement, Action, Assignment, CrossReference, Grammar, ParserRule } from "../gen/ast";
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode } from "./node/node";
import { process } from "./node/node-processor";
import { findAllFeatures } from "./utils";

export function generateGrammarAccess(grammar: Grammar, path?: string, bootstrap = false): string {
    const node = new CompositeGeneratorNode();

    const langiumPath = "'" + (path ?? "langium") + "'";
    node.children.push("import { GrammarAccess } from ", langiumPath, new NewLineNode(), "import { Action, Assignment, CrossReference, Keyword, RuleCall } from './ast'", new NewLineNode(), new NewLineNode());

    grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule).forEach(e => {
        node.children.push(generateRuleAccess(e), new NewLineNode(), new NewLineNode());
    });

    node.children.push("export class ", grammar.name + "GrammarAccess extends GrammarAccess {", new NewLineNode());

    const content = new IndentNode(4);

    grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule).forEach(e => {
        if (bootstrap) {
            content.children.push(e.name, generateBootstrapRuleAccess(e), new NewLineNode());
        } else {
            content.children.push(e.name, " = this.buildAccess<", e.name, "RuleAccess>('", e.name, "');", new NewLineNode());
        }
    });

    node.children.push(content, "}");

    return process(node);
}

function generateBootstrapRuleAccess(rule: ParserRule): GeneratorNode {
    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();
    node.children.push(": ", rule.name, "RuleAccess = <", rule.name, "RuleAccess><unknown>{", new NewLineNode());
    const indent = new IndentNode(4);
    node.children.push(indent);
    Array.from(byName.entries()).forEach(e => {
        const [name, feature] = e;
        indent.children.push(name, ": ", generateFeature(feature.feature), new NewLineNode());
    });

    node.children.push("}");
    return node;
}

function generateFeature(feature: AbstractElement): GeneratorNode {
    const node = new CompositeGeneratorNode();
    node.children.push("{", new NewLineNode());

    const indent = new IndentNode(4);
    node.children.push(indent);
    if (Assignment.is(feature)) {
        indent.children.push("kind: Assignment.kind,", new NewLineNode());
        indent.children.push("feature: '", feature.feature ,"',", new NewLineNode());
        indent.children.push("operator: '", feature.operator, "',", new NewLineNode());
        indent.children.push("terminal: {", new NewLineNode());
        const terminal = new IndentNode(4);
        if (CrossReference.is(feature.terminal)) {
            terminal.children.push("kind: CrossReference.kind");
        } else {
            terminal.children.push("kind: 'unknown'");
        }
        indent.children.push(terminal, new NewLineNode(), "}", new NewLineNode());
    } else if (Action.is(feature)) {
        indent.children.push("kind: Action.kind,", new NewLineNode());
        indent.children.push("Type: '" + feature.Type + "',", new NewLineNode());
        indent.children.push("feature: '" + feature.feature + "',", new NewLineNode());
        indent.children.push("operator: '" + feature.operator + "'", new NewLineNode());
    } else {
        indent.children.push("kind: 'unknown'" , new NewLineNode());
    }

    node.children.push("},");
    return node;
}

function generateRuleAccess(rule: ParserRule): CompositeGeneratorNode {

    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();

    node.children.push("export type ", rule.name + "RuleAccess = {", new NewLineNode());

    const indent = new IndentNode(4);
    Array.from(byName.entries()).forEach(e => {
        const [name, {kind}] = e;
        indent.children.push(name, ": ", kind, ";", new NewLineNode());
    });

    node.children.push(indent, "}");

    return node;
}