/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */
import { LangiumDocumentConfiguration } from '../documents/document';
import * as ast from '../grammar/generated/ast';
import { CompositeCstNodeImpl } from '../parser/cst-node-builder';
import { AstNode, CstNode } from '../syntax-tree';
import { getContainerOfType, Mutable } from '../utils/ast-util';
import { createLangiumGrammarServices } from './langium-grammar-module';

type FeatureValue = {
    feature: ast.AbstractElement;
    kind: 'Keyword' | 'RuleCall' | 'Assignment' | 'CrossReference' | 'Action';
}

export type Cardinality = '?' | '*' | '+' | undefined;
export type Operator = '=' | '+=' | '?=' | undefined;

export function isOptional(cardinality?: Cardinality): boolean {
    return cardinality === '?' || cardinality === '*';
}

export function isArray(cardinality?: Cardinality): boolean {
    return cardinality === '*' || cardinality === '+';
}

export function isArrayOperator(operator?: Operator): boolean {
    return operator === '+=';
}

export function isDataTypeRule(rule: ast.ParserRule): boolean {
    const features = Array.from(findAllFeatures(rule).byFeature.keys());
    const onlyRuleCallsAndKeywords = features.every(e => ast.isRuleCall(e) || ast.isKeyword(e) || ast.isGroup(e) || ast.isAlternatives(e) || ast.isUnorderedGroup(e));
    if (onlyRuleCallsAndKeywords) {
        const ruleCallWithParserRule = features.filter(e => ast.isRuleCall(e) && ast.isParserRule(e.rule.ref) && !isDataTypeRule(e.rule.ref));
        return ruleCallWithParserRule.length === 0;
    }
    return false;
}

export function findAllFeatures(rule: { alternatives: ast.AbstractElement }): { byName: Map<string, FeatureValue>, byFeature: Map<ast.AbstractElement, string> } {
    const map = new Map<string, FeatureValue>();
    const featureMap = new Map<ast.AbstractElement, string>();
    putFeature(rule.alternatives, undefined, map, featureMap);
    const newMap = new Map<string, FeatureValue>();
    for (const [key, value] of map.entries()) {
        newMap.set(key.replace(/\^/g, ''), value);
    }
    const newFeatureMap = new Map<ast.AbstractElement, string>();
    for (const [key, value] of featureMap.entries()) {
        newFeatureMap.set(key, value.replace(/\^/g, ''));
    }
    return { byName: newMap, byFeature: newFeatureMap };
}

function putFeature(element: ast.AbstractElement, previous: string | undefined, byName: Map<string, FeatureValue>, byFeature: Map<ast.AbstractElement, string>) {
    if (ast.isAssignment(element)) {
        const fullName = (previous ?? '') + element.feature;
        byName.set(fullName, { feature: element, kind: 'Assignment' });
        byFeature.set(element, fullName);
        putFeature(element.terminal, fullName, byName, byFeature);
    } else if (ast.isRuleCall(element)) {
        const name = (previous ?? '') + element.rule.ref?.name + 'RuleCall';
        byName.set(name, { feature: element, kind: 'RuleCall' });
        byFeature.set(element, name);
    } else if (ast.isCrossReference(element)) {
        const name = (previous ?? '') + element.type.ref?.name + 'CrossReference';
        byName.set(name, { feature: element, kind: 'CrossReference' });
        byFeature.set(element, name);
    } else if (ast.isKeyword(element)) {
        const validName = replaceTokens(element.value) + 'Keyword';
        byName.set(validName, { feature: element, kind: 'Keyword' });
        byFeature.set(element, validName);
    } else if (ast.isAction(element)) {
        const name = (previous ?? '') + element.type + (element.feature ?? '') + 'Action';
        byName.set(name, { feature: element, kind: 'Action' });
        byFeature.set(element, name);
    } else if (ast.isAlternatives(element) || ast.isUnorderedGroup(element) || ast.isGroup(element)) {
        for (const subFeature of element.elements) {
            putFeature(subFeature, previous, byName, byFeature);
        }
    }
}

export function replaceTokens(input: string): string {
    let result = input.substring(1, input.length - 1);
    result = result.replace(/:/g, 'Colon');
    result = result.replace(/\./g, 'Dot');
    result = result.replace(/\//g, 'Slash');
    result = result.replace(/,/g, 'Comma');
    result = result.replace(/\(/g, 'ParenthesisOpen');
    result = result.replace(/\)/g, 'ParenthesisClose');
    result = result.replace(/\[/g, 'BracketOpen');
    result = result.replace(/\]/g, 'BracketClose');
    result = result.replace(/\{/g, 'CurlyOpen');
    result = result.replace(/\}/g, 'CurlyClose');
    result = result.replace(/\+/g, 'Plus');
    result = result.replace(/\*/g, 'Asterisk');
    result = result.replace(/\?/g, 'QuestionMark');
    result = result.replace(/!/g, 'ExclamationMark');
    result = result.replace(/\^/g, 'Caret');
    result = result.replace(/</g, 'LessThan');
    result = result.replace(/>/g, 'MoreThan');
    result = result.replace(/&/g, 'Ampersand');
    result = result.replace(/\|/g, 'Pipe');
    result = result.replace(/=/g, 'Equals');
    result = result.replace(/-/g, 'Dash');
    result = result.replace(/;/g, 'Semicolon');
    result = result.replace(/@/g, 'At');
    result = result[0].toUpperCase() + result.substring(1);
    return result;
}

export function findNodeForFeature(node: CstNode | undefined, feature: string | undefined, index?: number): CstNode | undefined {
    const nodes = findNodesForFeature(node, feature);
    if (nodes.length === 0) {
        return undefined;
    }
    if (index !== undefined) {
        index = Math.max(0, Math.min(index, nodes.length - 1));
    } else {
        index = 0;
    }
    return nodes[index];
}

/**
 * This `internal` declared method exists, as we want to find the first child with the specified feature.
 * When the own feature is named the same by accident, we will instead return the input value.
 * Therefore, we skip the first assignment check.
 * @param node The node to traverse/check for the specified feature
 * @param feature The specified feature to find
 * @param element The element of the initial node. Do not process nodes of other elements.
 * @param first Whether this is the first node of the whole check.
 * @returns A list of all nodes within this node that belong to the specified feature.
 */
function findNodesForFeatureInternal(node: CstNode | undefined, feature: string | undefined, element: AstNode | undefined, first: boolean): CstNode[] {
    if (!node || !feature || node.element !== element) {
        return [];
    }
    const nodeFeature = getContainerOfType(node.feature, ast.isAssignment);
    if (!first && nodeFeature && nodeFeature.feature === feature) {
        return [node];
    } else if (node instanceof CompositeCstNodeImpl) {
        return node.children.flatMap(e => findNodesForFeatureInternal(e, feature, element, false));
    }
    return [];
}

export function findNodesForFeature(node: CstNode | undefined, feature: string | undefined): CstNode[] {
    return findNodesForFeatureInternal(node, feature, node?.element, true);
}

export function getTypeName(rule: ast.AbstractRule | undefined): string {
    if (rule) {
        return rule.type ?? rule.name;
    } else {
        throw new Error('Unknown rule type');
    }
}

export function getRuleType(rule: ast.AbstractRule | undefined): string {
    if (ast.isParserRule(rule) && isDataTypeRule(rule) || ast.isTerminalRule(rule)) {
        return rule.type ?? 'string';
    }
    return getTypeName(rule);
}

export function loadGrammar(json: string): ast.Grammar {
    const services = createLangiumGrammarServices();
    const astNode = services.serializer.JsonSerializer.deserialize(json);
    if (!ast.isGrammar(astNode)) {
        throw new Error('Could not load grammar from specified json input.');
    }
    const grammar = astNode as Mutable<ast.Grammar>;
    const document = LangiumDocumentConfiguration.create('', 'langium', 0, '');
    document.parseResult = {
        lexerErrors: [],
        parserErrors: [],
        value: grammar
    };
    grammar.$document = document;
    document.precomputedScopes = services.references.ScopeComputation.computeScope(grammar);
    return grammar;
}
