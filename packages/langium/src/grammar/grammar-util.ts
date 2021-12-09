/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TextDocument } from 'vscode-languageserver-textdocument';
import { documentFromText, LangiumDocuments, PrecomputedScopes } from '../documents/document';
import * as ast from '../grammar/generated/ast';
import { CompositeCstNodeImpl } from '../parser/cst-node-builder';
import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription, CstNode } from '../syntax-tree';
import { getContainerOfType, getDocument, Mutable, streamAllContents } from '../utils/ast-util';
import { createLangiumGrammarServices } from './langium-grammar-module';
import { escapeRegExp } from '../utils/regex-util';
import { URI, Utils } from 'vscode-uri';

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

export function isCommentTerminal(terminalRule: ast.TerminalRule): boolean {
    return terminalRule.hidden && !' '.match(terminalRegex(terminalRule));
}

interface RuleWithAlternatives {
    alternatives: ast.AbstractElement;
}

export function findAllFeatures(rule: RuleWithAlternatives): { byName: Map<string, FeatureValue>, byFeature: Map<ast.AbstractElement, string> } {
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
    let result = input;
    result = result.replace(/\s+/g, 'Whitespace');
    result = result.replace(/:/g, 'Colon');
    result = result.replace(/\./g, 'Dot');
    result = result.replace(/\//g, 'Slash');
    result = result.replace(/\\/g, 'Backslash');
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
    result = result.replace(/_/g, 'Underscore');
    result = result.replace(/;/g, 'Semicolon');
    result = result.replace(/@/g, 'At');
    result = result.replace(/%/g, 'Percent');
    result = result.replace(/\$/g, 'Currency');
    result = result.replace(/"/g, 'DoubleQuote');
    result = result.replace(/'/g, 'SingleQuote');
    result = result.replace(/#/g, 'Hash');
    // The ß gets special treatment here, because its `toUpperCase` behavior is really weird.
    result = result.replace(/ß/g, 'Eszett');
    result = result[0].toUpperCase() + result.substring(1);
    result = replaceUnicodeTokens(result);
    return result;
}

export function replaceUnicodeTokens(input: string): string {
    let output = '';
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        if (char < 65 || char > 90 && char < 97 || char > 122) {
            output += `u${char}`;
        } else {
            output += input.charAt(i);
        }
    }
    return output;
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

export function findAssignment(cstNode: CstNode): ast.Assignment | undefined {
    let n: CstNode | undefined = cstNode;
    do {
        const assignment = getContainerOfType(n.feature, ast.isAssignment);
        if (assignment) {
            return assignment;
        }
        n = n.parent;
    } while (n);
    return undefined;
}

export function getTypeNameAtElement(rule: ast.ParserRule, element: ast.AbstractElement): string {
    const action = getActionAtElement(element);
    return action?.type ?? getTypeName(rule);
}

export function getActionAtElement(element: ast.AbstractElement): ast.Action | undefined {
    const parent = element.$container;
    if (ast.isGroup(parent)) {
        const elements = parent.elements;
        const index = elements.indexOf(element);
        for (let i = index - 1; i >= 0; i--) {
            const item = elements[i];
            if (ast.isAction(item)) {
                return item;
            } else {
                let action: ast.Action | undefined;
                streamAllContents(elements[i]).forEach(e => {
                    if (ast.isAction(e.node)) {
                        action = e.node;
                    }
                });
                if (action) {
                    return action;
                }
            }
        }
    }
    if (ast.isAbstractElement(parent)) {
        return getActionAtElement(parent);
    } else {
        return undefined;
    }
}

export function terminalRegex(terminalRule: ast.TerminalRule): string {
    return abstractElementToRegex(terminalRule.terminal);
}

// Using [\s\S]* allows to match everything, compared to . which doesn't match line terminators
const WILDCARD = /[\s\S]/.source;

function abstractElementToRegex(element: ast.AbstractElement): string {
    if (ast.isTerminalAlternatives(element)) {
        return terminalAlternativesToRegex(element);
    } else if (ast.isTerminalGroup(element)) {
        return terminalGroupToRegex(element);
    } else if (ast.isCharacterRange(element)) {
        return characterRangeToRegex(element);
    } else if (ast.isTerminalRuleCall(element)) {
        const rule = element.rule.ref;
        if (!rule) {
            throw new Error('Missing rule reference.');
        }
        return withCardinality(terminalRegex(rule), element.cardinality, true);
    } else if (ast.isNegatedToken(element)) {
        return negateTokenToRegex(element);
    } else if (ast.isUntilToken(element)) {
        return untilTokenToRegex(element);
    } else if (ast.isRegexToken(element)) {
        return withCardinality(element.regex, element.cardinality, true);
    } else if (ast.isWildcard(element)) {
        return withCardinality(WILDCARD, element.cardinality);
    } else {
        throw new Error('Invalid terminal element.');
    }
}

function terminalAlternativesToRegex(alternatives: ast.TerminalAlternatives): string {
    return withCardinality(`(${alternatives.elements.map(abstractElementToRegex).join('|')})`, alternatives.cardinality);
}

function terminalGroupToRegex(group: ast.TerminalGroup): string {
    return withCardinality(group.elements.map(abstractElementToRegex).join(''), group.cardinality);
}

function untilTokenToRegex(until: ast.UntilToken): string {
    return withCardinality(`${WILDCARD}*?${abstractElementToRegex(until.terminal)}`, until.cardinality);
}

function negateTokenToRegex(negate: ast.NegatedToken): string {
    return withCardinality(`(?!${abstractElementToRegex(negate.terminal)})${WILDCARD}*?`, negate.cardinality, true);
}

function characterRangeToRegex(range: ast.CharacterRange): string {
    if (range.right) {
        return withCardinality(`[${keywordToRegex(range.left)}-${keywordToRegex(range.right)}]`, range.cardinality);
    }
    return withCardinality(keywordToRegex(range.left), range.cardinality, true);
}

function keywordToRegex(keyword: ast.Keyword): string {
    return escapeRegExp(keyword.value);
}

function withCardinality(regex: string, cardinality?: string, wrap = false): string {
    if (cardinality) {
        if (wrap) {
            regex = `(${regex})`;
        }
        return `${regex}${cardinality}`;
    }
    return regex;
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

export function getEntryRule(grammar: ast.Grammar): ast.ParserRule | undefined {
    return grammar.rules.find(e => ast.isParserRule(e) && e.entry) as ast.ParserRule;
}

export function resolveImport(documents: LangiumDocuments, imp: ast.GrammarImport): ast.Grammar | undefined {
    if (imp.path === undefined || imp.path.length === 0) {
        return undefined;
    }
    const uri = Utils.dirname(getDocument(imp).uri);
    let grammarPath = imp.path;
    if (!grammarPath.endsWith('.langium')) {
        grammarPath += '.langium';
    }
    const resolvedUri = Utils.resolvePath(uri, grammarPath);
    try {
        const resolvedDocument = documents.getOrCreateDocument(resolvedUri);
        const node = resolvedDocument.parseResult.value;
        if (ast.isGrammar(node)) {
            return node;
        }
    } catch {
        // NOOP
    }
    return undefined;
}

export function resolveTransitiveImports(documents: LangiumDocuments, grammar: ast.Grammar): ast.Grammar[] {
    return resolveTransitiveImportsInternal(documents, grammar);
}

function resolveTransitiveImportsInternal(documents: LangiumDocuments, grammar: ast.Grammar, initialGrammar = grammar, visited: Set<URI> = new Set(), grammars: Set<ast.Grammar> = new Set()): ast.Grammar[] {
    const doc = getDocument(grammar);
    if (initialGrammar !== grammar) {
        grammars.add(grammar);
    }
    if (!visited.has(doc.uri)) {
        visited.add(doc.uri);
        for (const imp of grammar.imports) {
            const importedGrammar = resolveImport(documents, imp);
            if (importedGrammar) {
                resolveTransitiveImportsInternal(documents, importedGrammar, initialGrammar, visited, grammars);
            }
        }
    }
    return Array.from(grammars);
}

export function loadGrammar(json: string): ast.Grammar {
    const services = createLangiumGrammarServices().ServiceRegistry.all[0];
    const astNode = services.serializer.JsonSerializer.deserialize(json);
    if (!ast.isGrammar(astNode)) {
        throw new Error('Could not load grammar from specified json input.');
    }
    const grammar = astNode as Mutable<ast.Grammar>;
    const textDocument = TextDocument.create('memory://grammar.langium', 'langium', 0, '');
    const document = documentFromText(textDocument, {
        lexerErrors: [],
        parserErrors: [],
        value: grammar
    });
    grammar.$document = document;
    document.precomputedScopes = computeGrammarScope(services, grammar);
    return grammar;
}

export function computeGrammarScope(services: LangiumServices, grammar: ast.Grammar): PrecomputedScopes {
    const nameProvider = services.references.NameProvider;
    const descriptions = services.index.AstNodeDescriptionProvider;
    const document = getDocument(grammar);
    const scopes = new Map<AstNode, AstNodeDescription[]>();
    for (const content of streamAllContents(grammar)) {
        const { node } = content;
        const container = node.$container;
        if (container) {
            const name = nameProvider.getName(node);
            if (name) {
                const description = descriptions.createDescription(node, name, document);
                if (scopes.has(container)) {
                    scopes.get(container)?.push(description);
                } else {
                    scopes.set(container, [description]);
                }
            }
        }
    }
    return scopes;
}
