/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NL, processGeneratorNode, findAllFeatures, getContainerOfType, streamAllContents, isAction, isAssignment, isCrossReference, isKeyword, isRuleCall, stream } from 'langium';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function generateGrammarAccess(grammar: langium.Grammar, config: LangiumConfig, bootstrap?: boolean): string {
    const node = new CompositeGeneratorNode();
    const imports = identifyImports(grammar).join(', ');
    node.contents.push(generatedHeader);
    if (config.langiumInternal) {
        node.contents.push("import { GrammarAccess } from '../grammar-access';", NL);
        node.contents.push(`import { ${imports} } from './ast';`);
    } else {
        node.contents.push(`import { ${imports}, GrammarAccess } from 'langium';`);
    }
    node.contents.push(NL, "import * as path from 'path';", NL, NL);

    for (const rule of stream(grammar.rules).filterType(langium.isParserRule)) {
        node.contents.push(generateRuleAccess(rule), NL, NL);
    }

    node.contents.push('export class ', grammar.name + 'GrammarAccess extends GrammarAccess {', NL);

    const content = new IndentNode();

    for (const rule of stream(grammar.rules).filterType(langium.isParserRule)) {
        if (bootstrap) {
            content.contents.push(rule.name, generateBootstrapRuleAccess(rule), NL);
        } else {
            content.contents.push(rule.name, ' = this.buildAccess<', rule.name, "RuleAccess>('", rule.name, "');", NL);
        }
    }

    const constructorNode = new IndentNode();
    constructorNode.contents.push("super(path.join(__dirname, 'grammar.json'));");
    content.contents.push(NL, 'constructor() {', NL, constructorNode, NL, '}', NL);
    node.contents.push(content, '}', NL);

    return processGeneratorNode(node);
}

function identifyImports(grammar: langium.Grammar): string[] {
    const items = new Set<string>();
    streamAllContents(grammar).forEach(e => {
        if (isAction(e.node) || isAssignment(e.node) || isCrossReference(e.node) || isKeyword(e.node) || isRuleCall(e.node)) {
            items.add(e.node.$type);
        }
    });
    return Array.from(items).sort();
}

function generateBootstrapRuleAccess(rule: langium.ParserRule): GeneratorNode {
    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();
    node.contents.push(': ', rule.name, 'RuleAccess = <', rule.name, 'RuleAccess><unknown>{', NL);
    const indent = new IndentNode();
    node.contents.push(indent);
    for (const [name, feature] of byName.entries()) {
        indent.contents.push(name, ': ', generateFeature(feature.feature), NL);
    }

    node.contents.push('}');
    return node;
}

function generateFeature(feature: langium.AbstractElement): GeneratorNode {
    const node = new CompositeGeneratorNode();
    node.contents.push('{', NL);

    const indent = new IndentNode();
    node.contents.push(indent);
    if (langium.isAssignment(feature)) {
        node.contents.push(generateAssignment(feature));
    } else if (langium.isAction(feature)) {
        indent.contents.push("$type: 'Action',", NL);
        indent.contents.push("type: '" + feature.type + "',", NL);
        indent.contents.push("feature: '" + feature.feature + "',", NL);
        indent.contents.push("operator: '" + feature.operator + "'", NL);
    } else if (langium.isRuleCall(feature) || langium.isCrossReference(feature) || langium.isKeyword(feature)) {
        const assignment = getContainerOfType(feature, langium.isAssignment);
        if (assignment) {
            indent.contents.push("$type: 'unknown'," , NL, '$container: {', NL, generateAssignment(assignment), '}', NL);
        } else {
            indent.contents.push("$type: 'unknown'" , NL);
        }
    }

    node.contents.push('},');
    return node;
}

function generateAssignment(assignment: langium.Assignment): GeneratorNode {
    const indent = new IndentNode();
    indent.contents.push("$type: 'Assignment',", NL);
    indent.contents.push("feature: '", assignment.feature ,"',", NL);
    indent.contents.push("operator: '", assignment.operator, "',", NL);
    indent.contents.push('terminal: {', NL);
    const terminal = new IndentNode();
    if (langium.isCrossReference(assignment.terminal)) {
        terminal.contents.push("$type: 'CrossReference'");
    } else {
        terminal.contents.push("$type: 'unknown'");
    }
    indent.contents.push(terminal, NL, '}', NL);
    return indent;
}

function generateRuleAccess(rule: langium.ParserRule): CompositeGeneratorNode {

    const { byName } = findAllFeatures(rule);

    const node = new CompositeGeneratorNode();

    node.contents.push('export type ', rule.name + 'RuleAccess = {', NL);

    const indent = new IndentNode();
    for (const [name, {kind}] of byName.entries()) {
        indent.contents.push(name, ': ', kind, ';', NL);
    }

    node.contents.push(indent, '}');

    return node;
}
