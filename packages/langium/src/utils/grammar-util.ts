/******************************************************************************
 * Copyright 2021-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Module } from '../dependency-injection';
import type { LangiumGrammarServices } from '../grammar/langium-grammar-module';
import type { LanguageMetaData } from '../grammar/language-meta-data';
import type { IParserConfig } from '../parser/parser-config';
import type { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumServices, LangiumSharedServices, PartialLangiumServices, PartialLangiumSharedServices } from '../services';
import type { AstNode, CstNode } from '../syntax-tree';
import type { Mutable } from '../utils/ast-util';
import { URI } from 'vscode-uri';
import { createDefaultModule, createDefaultSharedModule } from '../default-module';
import { inject } from '../dependency-injection';
import { interpretAstReflection } from '../grammar/ast-reflection-interpreter';
import * as ast from '../grammar/generated/ast';
import { terminalRegex } from '../grammar/internal-grammar-util';
import { createLangiumGrammarServices } from '../grammar/langium-grammar-module';
import { isCompositeCstNode } from '../syntax-tree';
import { getContainerOfType, getDocument, streamAllContents } from '../utils/ast-util';
import { streamCst } from '../utils/cst-util';
import { EmptyFileSystem } from '../workspace/file-system-provider';

/**
 * Returns the entry rule of the given grammar, if any. If the grammar file does not contain an entry rule,
 * the result is `undefined`.
 */
export function getEntryRule(grammar: ast.Grammar): ast.ParserRule | undefined {
    return grammar.rules.find(e => ast.isParserRule(e) && e.entry) as ast.ParserRule;
}

/**
 * Returns all hidden terminal rules of the given grammar, if any.
 */
export function getHiddenRules(grammar: ast.Grammar) {
    return grammar.rules.filter((e): e is ast.TerminalRule => ast.isTerminalRule(e) && e.hidden);
}

/**
 * Returns all rules that can be reached from the topmost rules of the specified grammar (entry and hidden terminal rules).
 *
 * @param grammar The grammar that contains all rules
 * @param allTerminals Whether or not to include terminals that are referenced only by other terminals
 * @returns A list of referenced parser and terminal rules. If the grammar contains no entry rule,
 *      this function returns all rules of the specified grammar.
 */
export function getAllReachableRules(grammar: ast.Grammar, allTerminals: boolean): Set<ast.AbstractRule> {
    const entryRule = getEntryRule(grammar);
    if (!entryRule) {
        return new Set(grammar.rules);
    }

    const topMostRules = [entryRule as ast.AbstractRule].concat(getHiddenRules(grammar));
    const collectedRules = new Set<ast.AbstractRule>();
    for (const rule of topMostRules) {
        ruleDfs(rule, collectedRules, allTerminals);
    }

    const rules = new Set<ast.AbstractRule>();
    for (const rule of grammar.rules) {
        if (collectedRules.has(rule) || ((ast.isTerminalRule(rule) && rule.hidden))) {
            rules.add(rule);
        }
    }
    for (const rule of collectedRules) {
        if (!rules.has(rule)) {
            rules.add(rule);
        }
    }

    return rules;
}

function ruleDfs(rule: ast.AbstractRule, visitedRules: Set<ast.AbstractRule> , allTerminals: boolean): void {
    visitedRules.add(rule);
    streamAllContents(rule).forEach(node => {
        if (ast.isRuleCall(node) || (allTerminals && ast.isTerminalRuleCall(node))) {
            const refRule = node.rule.ref;
            if (refRule && !visitedRules.has(refRule)) {
                ruleDfs(refRule, visitedRules, allTerminals);
            }
        } else if (ast.isCrossReference(node)) {
            const term = getCrossReferenceTerminal(node);
            if (term !== undefined) {
                if (ast.isRuleCall(term) || (allTerminals && ast.isTerminalRuleCall(term))) {
                    const refRule = term.rule.ref;
                    if (refRule && !visitedRules.has(refRule)) {
                        ruleDfs(refRule,  visitedRules, allTerminals);
                    }
                }
            }
        }
    });
}

/**
 * Determines the grammar expression used to parse a cross-reference (usually a reference to a terminal rule).
 * A cross-reference can declare this expression explicitly in the form `[Type : Terminal]`, but if `Terminal`
 * is omitted, this function attempts to infer it from the name of the referenced `Type` (using `findNameAssignment`).
 *
 * Returns the grammar expression used to parse the given cross-reference, or `undefined` if it is not declared
 * and cannot be inferred.
 */
export function getCrossReferenceTerminal(crossRef: ast.CrossReference): ast.AbstractElement | undefined {
    if (crossRef.terminal) {
        return crossRef.terminal;
    } else if (crossRef.type.ref) {
        const nameAssigment = findNameAssignment(crossRef.type.ref);
        return nameAssigment?.terminal;
    }
    return undefined;
}

/**
 * Determines whether the given terminal rule represents a comment. This is true if the rule is marked
 * as `hidden` and it does not match white space. This means every hidden token (i.e. excluded from the AST)
 * that contains visible characters is considered a comment.
 */
export function isCommentTerminal(terminalRule: ast.TerminalRule): boolean {
    return terminalRule.hidden && !terminalRegex(terminalRule).test(' ');
}

/**
 * Find all CST nodes within the given node that contribute to the specified property.
 *
 * @param node A CST node in which to look for property assignments. If this is undefined, the result is an empty array.
 * @param property A property name of the constructed AST node. If this is undefined, the result is an empty array.
 */
export function findNodesForProperty(node: CstNode | undefined, property: string | undefined): CstNode[] {
    if (!node || !property) {
        return [];
    }
    return findNodesForPropertyInternal(node, property, node.astNode, true);
}

/**
 * Find a single CST node within the given node that contributes to the specified property.
 *
 * @param node A CST node in which to look for property assignments. If this is undefined, the result is `undefined`.
 * @param property A property name of the constructed AST node. If this is undefined, the result is `undefined`.
 * @param index If no index is specified or the index is less than zero, the first found node is returned. If the
 *        specified index exceeds the number of assignments to the property, the last found node is returned. Otherwise,
 *        the node with the specified index is returned.
 */
export function findNodeForProperty(node: CstNode | undefined, property: string | undefined, index?: number): CstNode | undefined {
    if (!node || !property) {
        return undefined;
    }
    const nodes = findNodesForPropertyInternal(node, property, node.astNode, true);
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

function findNodesForPropertyInternal(node: CstNode, property: string, element: AstNode | undefined, first: boolean): CstNode[] {
    if (!first) {
        const nodeFeature = getContainerOfType(node.grammarSource, ast.isAssignment);
        if (nodeFeature && nodeFeature.feature === property) {
            return [node];
        }
    }
    if (isCompositeCstNode(node) && node.astNode === element) {
        return node.content.flatMap(e => findNodesForPropertyInternal(e, property, element, false));
    }
    return [];
}

/**
 * Find all CST nodes within the given node that correspond to the specified keyword.
 *
 * @param node A CST node in which to look for keywords. If this is undefined, the result is an empty array.
 * @param keyword A keyword as specified in the grammar.
 */
export function findNodesForKeyword(node: CstNode | undefined, keyword: string): CstNode[] {
    if (!node) {
        return [];
    }
    return findNodesForKeywordInternal(node, keyword, node?.astNode);
}

/**
 * Find a single CST node within the given node that corresponds to the specified keyword.
 *
 * @param node A CST node in which to look for keywords. If this is undefined, the result is `undefined`.
 * @param keyword A keyword as specified in the grammar.
 * @param index If no index is specified or the index is less than zero, the first found node is returned. If the
 *        specified index exceeds the number of keyword occurrences, the last found node is returned. Otherwise,
 *        the node with the specified index is returned.
 */
export function findNodeForKeyword(node: CstNode | undefined, keyword: string, index?: number): CstNode | undefined {
    if (!node) {
        return undefined;
    }
    const nodes = findNodesForKeywordInternal(node, keyword, node?.astNode);
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

export function findNodesForKeywordInternal(node: CstNode, keyword: string, element: AstNode | undefined): CstNode[] {
    if (node.astNode !== element) {
        return [];
    }
    if (ast.isKeyword(node.grammarSource) && node.grammarSource.value === keyword) {
        return [node];
    }
    const treeIterator = streamCst(node).iterator();
    let result: IteratorResult<CstNode>;
    const keywordNodes: CstNode[] = [];
    do {
        result = treeIterator.next();
        if (!result.done) {
            const childNode = result.value;
            if (childNode.astNode === element) {
                if (ast.isKeyword(childNode.grammarSource) && childNode.grammarSource.value === keyword) {
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
 * If the given CST node was parsed in the context of a property assignment, the respective `Assignment` grammar
 * node is returned. If no assignment is found, the result is `undefined`.
 *
 * @param cstNode A CST node for which to find a property assignment.
 */
export function findAssignment(cstNode: CstNode): ast.Assignment | undefined {
    const astNode = cstNode.astNode;
    // Only search until the ast node of the parent cst node is no longer the original ast node
    // This would make us jump to a preceding rule call, which contains only unrelated assignments
    while (astNode === cstNode.container?.astNode) {
        const assignment = getContainerOfType(cstNode.grammarSource, ast.isAssignment);
        if (assignment) {
            return assignment;
        }
        cstNode = cstNode.container;
    }
    return undefined;
}

/**
 * Find an assignment to the `name` property for the given grammar type. This requires the `type` to be inferred
 * from a parser rule, and that rule must contain an assignment to the `name` property. In all other cases,
 * this function returns `undefined`.
 */
export function findNameAssignment(type: ast.AbstractType | ast.InferredType): ast.Assignment | undefined {
    if (ast.isInferredType(type)) {
        // inferred type is unexpected, extract AbstractType first
        type = type.$container;
    }
    return findNameAssignmentInternal(type, new Map());
}

function findNameAssignmentInternal(type: ast.AbstractType, cache: Map<ast.AbstractType, ast.Assignment | undefined>): ast.Assignment | undefined {
    function go(node: AstNode, refType: ast.AbstractType): ast.Assignment | undefined {
        let childAssignment: ast.Assignment | undefined = undefined;
        const parentAssignment = getContainerOfType(node, ast.isAssignment);
        // No parent assignment implies unassigned rule call
        if (!parentAssignment) {
            childAssignment = findNameAssignmentInternal(refType, cache);
        }
        cache.set(type, childAssignment);
        return childAssignment;
    }

    if (cache.has(type)) return cache.get(type);
    cache.set(type, undefined);
    for (const node of streamAllContents(type)) {
        if (ast.isAssignment(node) && node.feature.toLowerCase() === 'name') {
            cache.set(type, node);
            return node;
        } else if (ast.isRuleCall(node) && ast.isParserRule(node.rule.ref)) {
            return go(node, node.rule.ref);
        } else if (ast.isSimpleType(node) && node.typeRef?.ref) {
            return go(node, node.typeRef.ref);
        }
    }
    return undefined;
}

/**
 * Load a Langium grammar for your language from a JSON string. This is used by several services,
 * most notably the parser builder which interprets the grammar to create a parser.
 */
export function loadGrammarFromJson(json: string): ast.Grammar {
    const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const astNode = services.serializer.JsonSerializer.deserialize(json) as Mutable<ast.Grammar>;
    services.shared.workspace.LangiumDocumentFactory.fromModel(astNode, URI.parse(`memory://${astNode.name ?? 'grammar'}.langium`));
    return astNode;
}

/**
 * Create an instance of the language services for the given grammar. This function is very
 * useful when the grammar is defined on-the-fly, for example in tests of the Langium framework.
 */
export async function createServicesForGrammar(config: {
    grammar: string | ast.Grammar,
    grammarServices?: LangiumGrammarServices,
    parserConfig?: IParserConfig,
    languageMetaData?: LanguageMetaData,
    module?: Module<LangiumServices, PartialLangiumServices>
    sharedModule?: Module<LangiumSharedServices, PartialLangiumSharedServices>
}): Promise<LangiumServices> {
    const grammarServices = config.grammarServices ?? createLangiumGrammarServices(EmptyFileSystem).grammar;
    const uri = URI.parse('memory:///grammar.langium');
    const factory = grammarServices.shared.workspace.LangiumDocumentFactory;
    const grammarDocument = typeof config.grammar === 'string'
        ? factory.fromString(config.grammar, uri)
        : getDocument(config.grammar);
    const grammarNode = grammarDocument.parseResult.value as ast.Grammar;
    const documentBuilder = grammarServices.shared.workspace.DocumentBuilder;
    await documentBuilder.build([grammarDocument], { validation: false });

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
    const shared = inject(createDefaultSharedModule(EmptyFileSystem), generatedSharedModule, config.sharedModule);
    const services = inject(createDefaultModule({ shared }), generatedModule, config.module);
    shared.ServiceRegistry.register(services);
    return services;
}
