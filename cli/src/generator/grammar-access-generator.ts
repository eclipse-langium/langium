import * as langium from 'langium';
import { AstNode } from 'langium';
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NL } from 'langium';
import { process } from 'langium';
import { findAllFeatures } from 'langium';

export function generateGrammarAccess(grammar: langium.Grammar, path?: string, bootstrap = false): string {
    const node = new CompositeGeneratorNode();

    const langiumPath = "'" + (path ?? 'langium') + "';";
    node.children.push('import { Action, Assignment, CrossReference, Keyword, RuleCall, GrammarAccess, retrocycle } from ', langiumPath, NL, NL);

    for (const rule of grammar.rules.filter(e => langium.isParserRule(e)).map(e => e as langium.ParserRule)) {
        node.children.push(generateRuleAccess(rule), NL, NL);
    }

    node.children.push('export class ', grammar.name + 'GrammarAccess extends GrammarAccess {', NL);

    const content = new IndentNode();

    for (const rule of grammar.rules.filter(e => langium.isParserRule(e)).map(e => e as langium.ParserRule)) {
        if (bootstrap) {
            content.children.push(rule.name, generateBootstrapRuleAccess(rule), NL);
        } else {
            content.children.push(rule.name, ' = this.buildAccess<', rule.name, "RuleAccess>('", rule.name, "');", NL);
        }
    }

    const constructorNode = new IndentNode();
    constructorNode.children.push('// eslint-disable-next-line @typescript-eslint/no-var-requires', NL, "super(retrocycle(require('./grammar.json')));");
    content.children.push(NL, 'constructor() {', NL, constructorNode, NL, '}', NL);
    node.children.push(content, '}');

    return process(node);
}

function generateBootstrapRuleAccess(rule: langium.ParserRule): GeneratorNode {
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

function generateFeature(feature: langium.AbstractElement): GeneratorNode {
    const node = new CompositeGeneratorNode();
    node.children.push('{', NL);

    const indent = new IndentNode();
    node.children.push(indent);
    if (langium.isAssignment(feature)) {
        node.children.push(generateAssignment(feature));
    } else if (langium.isAction(feature)) {
        indent.children.push('$type: Action.type,', NL);
        indent.children.push("type: '" + feature.type + "',", NL);
        indent.children.push("feature: '" + feature.feature + "',", NL);
        indent.children.push("operator: '" + feature.operator + "'", NL);
    } else if (langium.isRuleCall(feature) || langium.isCrossReference(feature) || langium.isKeyword(feature)) {
        const assignment = <langium.Assignment>AstNode.getContainer(feature, langium.Assignment.type);
        if (assignment) {
            indent.children.push("$type: 'unknown'," , NL, '$container: {', NL, generateAssignment(assignment), '}', NL);
        } else {
            indent.children.push("$type: 'unknown'" , NL);
        }
    }

    node.children.push('},');
    return node;
}

function generateAssignment(assignment: langium.Assignment): GeneratorNode {
    const indent = new IndentNode();
    indent.children.push('$type: Assignment.type,', NL);
    indent.children.push("feature: '", assignment.feature ,"',", NL);
    indent.children.push("operator: '", assignment.operator, "',", NL);
    indent.children.push('terminal: {', NL);
    const terminal = new IndentNode();
    if (langium.isCrossReference(assignment.terminal)) {
        terminal.children.push('$type: CrossReference.type');
    } else {
        terminal.children.push("$type: 'unknown'");
    }
    indent.children.push(terminal, NL, '}', NL);
    return indent;
}

function generateRuleAccess(rule: langium.ParserRule): CompositeGeneratorNode {

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