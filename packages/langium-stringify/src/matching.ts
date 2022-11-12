/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, GrammarAST, isAstNode, isReference } from 'langium';
import { getTypeName, isDataTypeRule } from 'langium/lib/grammar/internal-grammar-util';
import { ItemDescription, isAlternativesPropertyDescription, isGroupPropertyDescription, isPropertyDescription, ValueDescriptionMap } from './descriptions';
import { SerializationContext } from './serialization-cache';

export type ValueExpectation = RefExpectation | NodeExpectation | KeywordExpectation | TerminalExpectation;

export interface RefExpectation {
    referenceType: GrammarAST.AbstractType
}

export interface NodeExpectation {
    nodeType: GrammarAST.AbstractType | undefined
}

export interface KeywordExpectation {
    keyword: string
}

export interface TerminalExpectation {
    terminalType: GrammarAST.PrimitiveType
}

export function isRefExpectation(expectation: ValueExpectation): expectation is RefExpectation {
    return 'referenceType' in expectation;
}

export function isNodeExpectation(expectation: ValueExpectation): expectation is NodeExpectation {
    return 'nodeType' in expectation;
}

export function isKeywordExpectation(expectation: ValueExpectation): expectation is KeywordExpectation {
    return 'keyword' in expectation;
}

export function isTerminalExpectation(expectation: ValueExpectation): expectation is TerminalExpectation {
    return 'terminalType' in expectation;
}

export function matchDescriptions(context: SerializationContext, properties: ValueDescriptionMap, expected: ItemDescription): number {
    if (isPropertyDescription(expected)) {
        const property = properties.get(expected.property);
        if (!property) {
            return 0;
        }
        return Number(matchValue(context, property.value, expected.source));
    } else if (isGroupPropertyDescription(expected)) {
        return expected.elements
            .map(e => matchDescriptionWithOptional(context, properties, e))
            // Simply sum all matched descriptions
            .reduce((prev, curr) => prev + curr, 0);
    } else if (isAlternativesPropertyDescription(expected)) {
        return expected.alternatives
            .map(e => matchDescriptionWithOptional(context, properties, e))
            // Yield the maximum score of any alternative
            .reduce((prev, curr) => Math.max(prev, curr), 0);
    }
    return 0;
}

function matchDescriptionWithOptional(context: SerializationContext, properties: ValueDescriptionMap, expected: ItemDescription): number {
    return matchDescriptions(context, properties, expected) || Number(expected.optional);
}

function matchValue(context: SerializationContext, value: unknown, expected: GrammarAST.AbstractElement): boolean {
    const possibleExpectations = context.cache.getPossibleExpectations(expected, e => buildPossibleExpectations(e));
    return possibleExpectations.some(expectation => matchExpectation(context, value, expectation));
}

function matchExpectation(context: SerializationContext, value: unknown, expectation: ValueExpectation): boolean {
    if (isKeywordExpectation(expectation)) {
        return typeof value === 'string' && value === expectation.keyword;
    } else if (isTerminalExpectation(expectation)) {
        if (expectation.terminalType === 'Date') {
            return value instanceof Date;
        } else {
            return typeof value === expectation.terminalType;
        }
    }
    let targetType: GrammarAST.AbstractType;
    let targetNode: AstNode;
    if (isNodeExpectation(expectation)) {
        if (!isAstNode(value)) {
            return false;
        }
        if (!expectation.nodeType) {
            // We just expect any AST node at this point
            return true;
        }
        targetType = expectation.nodeType;
        targetNode = value;
    } else {
        targetType = expectation.referenceType;
        if (!isReference(value)) {
            return false;
        }
        const refTarget = value.ref;
        if (!refTarget) {
            throw new Error('Unresolved cross reference');
        }
        targetNode = refTarget;
    }
    return context.reflection.isInstance(targetNode, getTypeName(targetType));
}

function buildPossibleExpectations(element: GrammarAST.AbstractElement): ValueExpectation[] {
    if (GrammarAST.isAssignment(element)) {
        return buildPossibleExpectations(element.terminal);
    } else if (GrammarAST.isAlternatives(element)) {
        return element.elements.flatMap(alt => buildPossibleExpectations(alt));
    } else if (GrammarAST.isKeyword(element)) {
        return [{
            keyword: element.value
        }];
    } else if (GrammarAST.isRuleCall(element)) {
        const rule = element.rule.ref!;
        if (GrammarAST.isParserRule(rule)) {
            if (isDataTypeRule(rule)) {
                return [{
                    terminalType: rule.dataType ?? 'string'
                }];
            } else {
                return [{
                    nodeType: rule
                }];
            }
        } else {
            return [{
                terminalType: rule.type?.name as GrammarAST.PrimitiveType ?? 'string'
            }];
        }
    } else if (GrammarAST.isCrossReference(element)) {
        const targetType = element.type.ref!;
        return [{
            referenceType: targetType
        }];
    } else if (GrammarAST.isAction(element) && element.feature) {
        return [{
            nodeType: undefined
        }];
    }
    return [];
}