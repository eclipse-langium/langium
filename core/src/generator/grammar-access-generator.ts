import { AbstractElement, Action, Assignment, CrossReference, Grammar, Keyword, ParserRule, RuleCall } from '../gen/ast';
import { AstNode } from './ast-node';
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NL } from './node/node';
import { process } from './node/node-processor';
import { findAllFeatures } from './utils';

export function generateGrammarAccess(grammar: Grammar, path?: string, bootstrap = false): string {
    const node = new CompositeGeneratorNode();

    const langiumPath = "'" + (path ?? 'langium') + "';";
    node.children.push('import { GrammarAccess } from ', langiumPath, NL, "import { Action, Assignment, CrossReference, Keyword, RuleCall } from './ast';", NL, NL);

    for (const rule of grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule)) {
        node.children.push(generateRuleAccess(rule), NL, NL);
    }

    node.children.push('export class ', grammar.name + 'GrammarAccess extends GrammarAccess {', NL);

    const content = new IndentNode();

    for (const rule of grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule)) {
        if (bootstrap) {
            content.children.push(rule.name, generateBootstrapRuleAccess(rule), NL);
        } else {
            content.children.push(rule.name, ' = this.buildAccess<', rule.name, "RuleAccess>('", rule.name, "');", NL);
        }
    }

    node.children.push(content, '}');

    return process(node);
}

function generateBootstrapRuleAccess(rule: ParserRule): GeneratorNode {
    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();
    node.children.push(': ', rule.name, 'RuleAccess = <', rule.name, 'RuleAccess><unknown>{', NL);
    const indent = new IndentNode();
    node.children.push(indent);
    for (const [name, feature] of Array.from(byName.entries())) {
        indent.children.push(name, ': ', generateFeature(feature.feature), NL);
    }

    node.children.push('}');
    return node;
}

function generateFeature(feature: AbstractElement): GeneratorNode {
    const node = new CompositeGeneratorNode();
    node.children.push('{', NL);

    const indent = new IndentNode();
    node.children.push(indent);
    if (Assignment.is(feature)) {
        node.children.push(generateAssignment(feature));
    } else if (Action.is(feature)) {
        indent.children.push('kind: Action.kind,', NL);
        indent.children.push("type: '" + feature.type + "',", NL);
        indent.children.push("feature: '" + feature.feature + "',", NL);
        indent.children.push("operator: '" + feature.operator + "'", NL);
    } else if (RuleCall.is(feature) || CrossReference.is(feature) || Keyword.is(feature)) {
        const assignment = <Assignment>AstNode.getContainer(feature, Assignment.kind);
        if (assignment) {
            indent.children.push("kind: 'unknown'," , NL, 'container: {', NL, generateAssignment(assignment), '}', NL);
        } else {
            indent.children.push("kind: 'unknown'" , NL);
        }
    }

    node.children.push('},');
    return node;
}

function generateAssignment(assignment: Assignment): GeneratorNode {
    const indent = new IndentNode();
    indent.children.push('kind: Assignment.kind,', NL);
    indent.children.push("feature: '", assignment.feature ,"',", NL);
    indent.children.push("operator: '", assignment.operator, "',", NL);
    indent.children.push('terminal: {', NL);
    const terminal = new IndentNode();
    if (CrossReference.is(assignment.terminal)) {
        terminal.children.push('kind: CrossReference.kind');
    } else {
        terminal.children.push("kind: 'unknown'");
    }
    indent.children.push(terminal, NL, '}', NL);
    return indent;
}

function generateRuleAccess(rule: ParserRule): CompositeGeneratorNode {

    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();

    node.children.push('export type ', rule.name + 'RuleAccess = {', NL);

    const indent = new IndentNode();
    for (const [name, {kind}] of Array.from(byName.entries())) {
        indent.children.push(name, ': ', kind, ';', NL);
    }

    node.children.push(indent, '}');

    return node;
}