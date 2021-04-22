import { AbstractElement, Action, Assignment, CrossReference, Grammar, ParserRule } from '../gen/ast';
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode } from './node/node';
import { process } from './node/node-processor';
import { findAllFeatures } from './utils';

export function generateGrammarAccess(grammar: Grammar, path?: string, bootstrap = false): string {
    const node = new CompositeGeneratorNode();

    const langiumPath = "'" + (path ?? 'langium') + "'";
    node.children.push('import { GrammarAccess } from ', langiumPath, new NewLineNode(), "import { Action, Assignment, CrossReference, Keyword, RuleCall } from './ast'", new NewLineNode(), new NewLineNode());

    for (const rule of grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule)) {
        node.children.push(generateRuleAccess(rule), new NewLineNode(), new NewLineNode());
    }

    node.children.push('export class ', grammar.name + 'GrammarAccess extends GrammarAccess {', new NewLineNode());

    const content = new IndentNode();

    for (const rule of grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule)) {
        if (bootstrap) {
            content.children.push(rule.name, generateBootstrapRuleAccess(rule), new NewLineNode());
        } else {
            content.children.push(rule.name, ' = this.buildAccess<', rule.name, "RuleAccess>('", rule.name, "');", new NewLineNode());
        }
    }

    node.children.push(content, '}');

    return process(node);
}

function generateBootstrapRuleAccess(rule: ParserRule): GeneratorNode {
    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();
    node.children.push(': ', rule.name, 'RuleAccess = <', rule.name, 'RuleAccess><unknown>{', new NewLineNode());
    const indent = new IndentNode();
    node.children.push(indent);
    for (const [name, feature] of Array.from(byName.entries())) {
        indent.children.push(name, ': ', generateFeature(feature.feature), new NewLineNode());
    }

    node.children.push('}');
    return node;
}

function generateFeature(feature: AbstractElement): GeneratorNode {
    const node = new CompositeGeneratorNode();
    node.children.push('{', new NewLineNode());

    const indent = new IndentNode();
    node.children.push(indent);
    if (Assignment.is(feature)) {
        indent.children.push('kind: Assignment.kind,', new NewLineNode());
        indent.children.push("feature: '", feature.feature ,"',", new NewLineNode());
        indent.children.push("operator: '", feature.operator, "',", new NewLineNode());
        indent.children.push('terminal: {', new NewLineNode());
        const terminal = new IndentNode();
        if (CrossReference.is(feature.terminal)) {
            terminal.children.push('kind: CrossReference.kind');
        } else {
            terminal.children.push("kind: 'unknown'");
        }
        indent.children.push(terminal, new NewLineNode(), '}', new NewLineNode());
    } else if (Action.is(feature)) {
        indent.children.push('kind: Action.kind,', new NewLineNode());
        indent.children.push("Type: '" + feature.Type + "',", new NewLineNode());
        indent.children.push("feature: '" + feature.feature + "',", new NewLineNode());
        indent.children.push("operator: '" + feature.operator + "'", new NewLineNode());
    } else {
        indent.children.push("kind: 'unknown'" , new NewLineNode());
    }

    node.children.push('},');
    return node;
}

function generateRuleAccess(rule: ParserRule): CompositeGeneratorNode {

    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();

    node.children.push('export type ', rule.name + 'RuleAccess = {', new NewLineNode());

    const indent = new IndentNode();
    for (const [name, {kind}] of Array.from(byName.entries())) {
        indent.children.push(name, ': ', kind, ';', new NewLineNode());
    }

    node.children.push(indent, '}');

    return node;
}