/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, GrammarAST, isAstNode, isReference } from 'langium';
import { ItemDescription, isAlternativesPropertyDescription, isGroupPropertyDescription, isPropertyDescription, ValueDescriptionMap } from './descriptions';
import { SerializationContext } from './serialization-cache';

export type ValueExpectation = RefExpectation | NodeExpectation | KeywordExpectation | TerminalExpectation;

export interface RefExpectation {
    referenceType: GrammarAST.AbstractType
}

export interface NodeExpectation {
    nodeType: GrammarAST.AbstractType
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

export function matchDescriptions(context: SerializationContext, properties: ValueDescriptionMap, expected: ItemDescription): boolean {
    if (isPropertyDescription(expected)) {
        const property = properties.get(expected.property);
        if (!property) {
            return false;
        }
        return matchValue(context, property.value, expected.source);
    } else if (isGroupPropertyDescription(expected)) {
        return expected.elements.every(e => matchDescriptionWithOptional(context, properties, e));
    } else if (isAlternativesPropertyDescription(expected)) {
        return expected.alternatives.some(e => matchDescriptionWithOptional(context, properties, e));
    }
    return true;
}

function matchDescriptionWithOptional(context: SerializationContext, properties: ValueDescriptionMap, expected: ItemDescription): boolean {
    return expected.optional || matchDescriptions(context, properties, expected);
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
        targetType = expectation.nodeType;
        if (!isAstNode(value)) {
            return false;
        }
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
    return context.reflection.isInstance(targetNode, targetType.$type);
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
            return [{
                nodeType: rule
            }];
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
    }
    return [];
}