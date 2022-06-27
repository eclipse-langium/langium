/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as ast from '../grammar/generated/ast';
import { URI, Utils } from 'vscode-uri';
import { createDefaultSharedModule, createLangiumGrammarServices } from '../browser/browser-module';
import { createDefaultModule } from '../default-module';
import { inject, Module } from '../dependency-injection';
import { CompositeCstNodeImpl } from '../parser/cst-node-builder';
import { IParserConfig } from '../parser/parser-config';
import { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumServices, LangiumSharedServices } from '../services';
import { AstNode, AstNodeDescription, CstNode } from '../syntax-tree';
import { extractRootNode, getContainerOfType, getDocument, Mutable, streamAllContents } from '../utils/ast-util';
import { MultiMap } from '../utils/collections';
import { streamCst } from '../utils/cst-util';
import { escapeRegExp } from '../utils/regex-util';
import { AstNodeDescriptionProvider } from '../workspace/ast-descriptions';
import { AstNodeLocator } from '../workspace/ast-node-locator';
import { LangiumDocument, LangiumDocuments, PrecomputedScopes } from '../workspace/documents';
import { interpretAstReflection } from './ast-reflection-interpreter';
import { LangiumGrammarServices } from './langium-grammar-module';
import { LanguageMetaData } from './language-meta-data';
import { TypeResolutionError } from './type-system/types-util';

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

export function getCrossReferenceTerminal(crossRef: ast.CrossReference): ast.AbstractElement | undefined {
    if (crossRef.terminal) {
        return crossRef.terminal;
    } else if (crossRef.type.ref) {
        const nameAssigment = findNameAssignment(crossRef.type.ref);
        return nameAssigment?.terminal;
    }
    return undefined;
}

export function findNameAssignment(type: ast.AbstractType | ast.InferredType): ast.Assignment | undefined {
    if (ast.isInferredType(type)) {
        // inferred type is unexpected, extract AbstractType first
        type = type.$container;
    }
    return findNameAssignmentInternal(type, new Map());
}

function findNameAssignmentInternal(type: ast.AbstractType, cashed: Map<ast.AbstractType, ast.Assignment | undefined>): ast.Assignment | undefined {
    function go(node: AstNode, refType: ast.AbstractType): ast.Assignment | undefined {
        let childAssignment: ast.Assignment | undefined = undefined;
        const parentAssignment = getContainerOfType(node, ast.isAssignment);
        // No parent assignment implies unassigned rule call
        if (!parentAssignment) {
            childAssignment = findNameAssignmentInternal(refType, cashed);
        }
        cashed.set(type, childAssignment);
        return childAssignment;
    }

    if (cashed.has(type)) return cashed.get(type);
    cashed.set(type, undefined);
    for (const node of streamAllContents(type)) {
        if (ast.isAssignment(node) && node.feature.toLowerCase() === 'name') {
            cashed.set(type, node);
            return node;
        } else if (ast.isRuleCall(node) && ast.isParserRule(node.rule.ref)) {
            return go(node, node.rule.ref);
        } else if (ast.isAtomType(node) && node?.refType?.ref) {
            return go(node, node.refType.ref);
        }
    }
    return undefined;
}

export function isCommentTerminal(terminalRule: ast.TerminalRule): boolean {
    return terminalRule.hidden && !' '.match(terminalRegex(terminalRule));
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

export function findKeywordNodes(node: CstNode | undefined, keyword: string): CstNode[] {
    return findKeywordNodesInternal(node, keyword, node?.element);
}

export function findKeywordNode(node: CstNode | undefined, keyword: string, index?: number): CstNode | undefined {
    const nodes = findKeywordNodesInternal(node, keyword, node?.element);
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

export function findKeywordNodesInternal(node: CstNode | undefined, keyword: string, element: AstNode | undefined): CstNode[] {
    if (!node || !keyword || node.element !== element) {
        return [];
    }
    if (ast.isKeyword(node.feature) && node.feature.value === keyword) {
        return [node];
    }
    const treeIterator = streamCst(node).iterator();
    let result: IteratorResult<CstNode>;
    const keywordNodes: CstNode[] = [];
    do {
        result = treeIterator.next();
        if (!result.done) {
            const childNode = result.value;
            if (childNode.element === element) {
                if (ast.isKeyword(childNode.feature) && childNode.feature.value === keyword) {
                    keywordNodes.push(childNode);
                }
            } else {
                treeIterator.prune();
            }
        }
    } while (!result.done);
    return keywordNodes;
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
    if (!node || !feature) {
        return [];
    }
    const nodeFeature = getContainerOfType(node.feature, ast.isAssignment);
    if (!first && nodeFeature && nodeFeature.feature === feature) {
        return [node];
    } else if (node instanceof CompositeCstNodeImpl && node.element === element) {
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
    return action ? getTypeName(action) : getTypeName(rule);
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

export function getTypeName(type: ast.AbstractType | ast.InferredType): string {
    if (ast.isParserRule(type)) {
        return getExplicitRuleType(type) ?? type.name;
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

export function createServicesForGrammar(config: {
    grammar: string | ast.Grammar,
    grammarServices?: LangiumGrammarServices,
    parserConfig?: IParserConfig,
    languageMetaData?: LanguageMetaData,
    module?: Module<LangiumServices>
    sharedModule?: Module<LangiumSharedServices>
}): LangiumServices {
    const grammarServices = config.grammarServices ?? createLangiumGrammarServices().grammar;
    const grammarNode = typeof config.grammar === 'string' ? grammarServices.parser.LangiumParser.parse<ast.Grammar>(config.grammar).value : config.grammar;
    prepareGrammar(grammarServices, grammarNode);

    const parserConfig = config.parserConfig ?? {
        skipValidations: false
    };
    const languageMetaData = config.languageMetaData ?? {
        caseInsensitive: false,
        fileExtensions: [`.${grammarNode.name?.toLowerCase() ?? 'unknown'}`],
        languageId: grammarNode.name ?? 'UNKNOWN'
    };
    const generatedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
        AstReflection: () => interpretAstReflection(grammarNode),
    };
    const generatedModule: Module<LangiumServices, LangiumGeneratedServices> = {
        Grammar: () => grammarNode,
        LanguageMetaData: () => languageMetaData,
        parser: {
            ParserConfig: () => parserConfig
        }
    };
    const shared = inject(createDefaultSharedModule(), generatedSharedModule, config.sharedModule);
    const services = inject(createDefaultModule({ shared }), generatedModule, config.module);
    return services;
}

export function loadGrammar(json: string): ast.Grammar {
    const services = createLangiumGrammarServices().grammar;
    const astNode = services.serializer.JsonSerializer.deserialize(json);
    if (!ast.isGrammar(astNode)) {
        throw new Error('Could not load grammar from specified json input.');
    }
    return prepareGrammar(services, astNode);
}

function prepareGrammar(services: LangiumServices, grammar: ast.Grammar): ast.Grammar {
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
 * Add synthetic Interface in case of explicitly inferred type:<br>
 * case: `{infer Action}`
 * @param astNodeLocator AstNodeLocator
 * @returns scope populator
 */
export function processActionNodeWithNodeDescriptionProvider(descriptions: AstNodeDescriptionProvider): (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => void {
    return (node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes) => {
        const container = extractRootNode(node);
        if (container && ast.isAction(node) && node.inferredType) {
            const typeName = getActionType(node);
            if(typeName) {
                scopes.add(container, descriptions.createDescription(node, typeName, document));
            }
        }
    };
}
