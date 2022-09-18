/******************************************************************************
 * Copyright 2021-2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as ast from '../grammar/generated/ast';
import { URI, Utils } from 'vscode-uri';
import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription } from '../syntax-tree';
import { findRootNode, getDocument, Mutable, streamAllContents } from '../utils/ast-util';
import { MultiMap } from '../utils/collections';
import { AstNodeDescriptionProvider } from '../workspace/ast-descriptions';
import { AstNodeLocator } from '../workspace/ast-node-locator';
import { LangiumDocument, LangiumDocuments, PrecomputedScopes } from '../workspace/documents';
import { TypeResolutionError } from './type-system/types-util';
import { escapeRegExp } from '../utils/regex-util';

export type Cardinality = '?' | '*' | '+' | undefined;
export type Operator = '=' | '+=' | '?=' | undefined;

export function isOptionalCardinality(cardinality?: Cardinality): boolean {
    return cardinality === '?' || cardinality === '*';
}

export function isArrayCardinality(cardinality?: Cardinality): boolean {
    return cardinality === '*' || cardinality === '+';
}

export function isArrayOperator(operator?: Operator): boolean {
    return operator === '+=';
}

/**
 * Determines whether the given parser rule is a _data type rule_, meaning that it has a
 * primitive return type like `number`, `boolean`, etc.
 */
export function isDataTypeRule(rule: ast.ParserRule): boolean {
    return isDataTypeRuleInternal(rule, new Set());
}

function isDataTypeRuleInternal(rule: ast.ParserRule, visited: Set<ast.ParserRule>): boolean {
    if (visited.has(rule)) {
        return true;
    }
    visited.add(rule);
    for (const node of streamAllContents(rule)) {
        if (ast.isRuleCall(node) && ast.isParserRule(node.rule.ref)) {
            if (!isDataTypeRuleInternal(node.rule.ref, visited)) {
                return false;
            }
        } else if (ast.isAssignment(node)) {
            return false;
        } else if (ast.isAction(node)) {
            return false;
        }
    }
    return true;
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
                const action = streamAllContents(elements[i]).find(ast.isAction);
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

export function getTypeName(type: ast.AbstractType | ast.InferredType): string {
    if (ast.isParserRule(type)) {
        return isDataTypeRule(type) ? type.name : getExplicitRuleType(type) ?? type.name;
    } else if (ast.isInterface(type) || ast.isType(type) || ast.isReturnType(type)) {
        return type.name;
    } else if (ast.isAction(type)) {
        const actionType = getActionType(type);
        if (actionType) {
            return actionType;
        }
    } else if (ast.isInferredType(type)) {
        return type.name;
    }
    throw new TypeResolutionError('Cannot get name of Unknown Type', type.$cstNode);
}

export function getExplicitRuleType(rule: ast.ParserRule): string | undefined {
    if (rule.inferredType) {
        return rule.inferredType.name;
    } else if (rule.dataType) {
        return rule.dataType;
    } else if (rule.returnType) {
        const refType = rule.returnType.ref;
        if(refType) {
            // check if we need to check Action as return type
            if (ast.isParserRule(refType)) {
                return refType.name;
            }  else if(ast.isInterface(refType) || ast.isType(refType)) {
                return refType.name;
            }
        }
    }
    return undefined;
}

function getActionType(action: ast.Action): string | undefined {
    if(action.inferredType) {
        return action.inferredType.name;
    } else if (action.type?.ref) {
        return getTypeName(action.type.ref);
    }
    return undefined; // not inferring and not referencing a valid type
}

export function getRuleType(rule: ast.AbstractRule): string {
    if (ast.isTerminalRule(rule)) {
        return rule.type?.name ?? 'string';
    } else {
        return isDataTypeRule(rule) ? rule.name : getExplicitRuleType(rule) ?? rule.name;
    }
}

export function terminalRegex(terminalRule: ast.TerminalRule): string {
    return abstractElementToRegex(terminalRule.definition);
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
        return withCardinality(terminalRegex(rule), element.cardinality);
    } else if (ast.isNegatedToken(element)) {
        return negateTokenToRegex(element);
    } else if (ast.isUntilToken(element)) {
        return untilTokenToRegex(element);
    } else if (ast.isRegexToken(element)) {
        return withCardinality(element.regex, element.cardinality, false);
    } else if (ast.isWildcard(element)) {
        return withCardinality(WILDCARD, element.cardinality);
    } else {
        throw new Error('Invalid terminal element.');
    }
}

function terminalAlternativesToRegex(alternatives: ast.TerminalAlternatives): string {
    return withCardinality(alternatives.elements.map(abstractElementToRegex).join('|'), alternatives.cardinality);
}

function terminalGroupToRegex(group: ast.TerminalGroup): string {
    return withCardinality(group.elements.map(abstractElementToRegex).join(''), group.cardinality);
}

function untilTokenToRegex(until: ast.UntilToken): string {
    return withCardinality(`${WILDCARD}*?${abstractElementToRegex(until.terminal)}`, until.cardinality);
}

function negateTokenToRegex(negate: ast.NegatedToken): string {
    return withCardinality(`(?!${abstractElementToRegex(negate.terminal)})${WILDCARD}*?`, negate.cardinality);
}

function characterRangeToRegex(range: ast.CharacterRange): string {
    if (range.right) {
        return withCardinality(`[${keywordToRegex(range.left)}-${keywordToRegex(range.right)}]`, range.cardinality, false);
    }
    return withCardinality(keywordToRegex(range.left), range.cardinality, false);
}

function keywordToRegex(keyword: ast.Keyword): string {
    return escapeRegExp(keyword.value);
}

function withCardinality(regex: string, cardinality?: string, wrap = true): string {
    if (wrap) {
        regex = `(${regex})`;
    }
    if (cardinality) {
        return `${regex}${cardinality}`;
    }
    return regex;
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

export function resolveTransitiveImports(documents: LangiumDocuments, grammar: ast.Grammar | ast.GrammarImport): ast.Grammar[] {
    if (ast.isGrammarImport(grammar)) {
        const resolvedGrammar = resolveImport(documents, grammar);
        if (resolvedGrammar) {
            const transitiveGrammars = resolveTransitiveImportsInternal(documents, resolvedGrammar);
            transitiveGrammars.push(resolvedGrammar);
            return transitiveGrammars;
        }
        return [];
    } else {
        return resolveTransitiveImportsInternal(documents, grammar);
    }
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

export function prepareGrammar(services: LangiumServices, grammar: ast.Grammar): ast.Grammar {
    const mutableGrammar = grammar as Mutable<ast.Grammar>;
    const document = services.shared.workspace.LangiumDocumentFactory.fromModel(grammar, URI.parse('memory://grammar.langium'));
    mutableGrammar.$document = document;
    document.precomputedScopes = computeGrammarScope(services, grammar);
    return grammar;
}

function computeGrammarScope(services: LangiumServices, grammar: ast.Grammar): PrecomputedScopes {
    const nameProvider = services.references.NameProvider;
    const descriptions = services.workspace.AstNodeDescriptionProvider;
    const document = getDocument(grammar);
    const scopes = new MultiMap<AstNode, AstNodeDescription>();
    const processTypeNode = processTypeNodeWithNodeLocator(services.workspace.AstNodeLocator);
    const processActionNode = processActionNodeWithNodeDescriptionProvider(descriptions);
    for (const node of streamAllContents(grammar)) {
        if (ast.isReturnType(node)) continue;
        processActionNode(node, document, scopes);
        processTypeNode(node, document, scopes);
        const container = node.$container;
        if (container) {
            const name = nameProvider.getName(node);
            if (name) {
                scopes.add(container, descriptions.createDescription(node, name, document));
            }
        }
    }
    return scopes;
}

/**
 * Add synthetic Interface in case of explicitly or implicitly inferred type:<br>
 * cases: `ParserRule: ...;` or `ParserRule infers Type: ...;`
 * @param astNodeLocator AstNodeLocator
 * @returns scope populator
 */
export function processTypeNodeWithNodeLocator(astNodeLocator: AstNodeLocator): (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => void {
    return (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => {
        const container = node.$container;
        if (container && ast.isParserRule(node) && !node.returnType && !node.dataType) {
            const typeNode = node.inferredType ?? node;
            scopes.add(container, {
                node: typeNode,
                name: typeNode.name,
                type: 'Interface',
                documentUri: document.uri,
                path: astNodeLocator.getAstNodePath(typeNode)
            });
        }
    };
}

/**
 * Add synthetic Interface in case of explicitly inferred type:
 *
 * case: `{infer Action}`
 */
export function processActionNodeWithNodeDescriptionProvider(descriptions: AstNodeDescriptionProvider): (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => void {
    return (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => {
        const container = findRootNode(node);
        if (container && ast.isAction(node) && node.inferredType) {
            const typeName = getActionType(node);
            if (typeName) {
                scopes.add(container, descriptions.createDescription(node, typeName, document));
            }
        }
    };
}

export function extractAssignments(element: ast.AbstractElement): ast.Assignment[] {
    if (ast.isAssignment(element)) {
        return [element];
    } if (ast.isAlternatives(element) || ast.isGroup(element) || ast.isUnorderedGroup(element)) {
        return element.elements.flatMap(e => extractAssignments(e));
    }
    return [];
}
