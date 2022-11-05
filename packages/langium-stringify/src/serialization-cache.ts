/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, AstReflection, GrammarAST } from 'langium';
import type { ItemDescription } from './descriptions';
import type { ValueExpectation } from './matching';

export interface SerializationContext {
    cache: SerializationCache
    reflection: AstReflection
}

export class SerializationCache {

    protected nodeCandidates = new Map<string, GrammarAST.AbstractElement[]>();
    protected propertyDescriptions = new Map<GrammarAST.AbstractElement, ItemDescription | undefined>();
    protected possibleExpectations = new Map<GrammarAST.AbstractElement, ValueExpectation[]>();

    getNodeCandidates(node: AstNode, rule: GrammarAST.ParserRule, callback: (node: AstNode, rule: GrammarAST.ParserRule) => GrammarAST.AbstractElement[]): GrammarAST.AbstractElement[] {
        const key = node.$type + ':' + rule.name;
        const existing = this.nodeCandidates.get(key);
        if (existing) {
            return existing;
        }
        const value = callback(node, rule);
        this.nodeCandidates.set(key, value);
        return value;
    }

    getPropertyDescriptions(element: GrammarAST.AbstractElement, callback: (element: GrammarAST.AbstractElement) => ItemDescription | undefined): ItemDescription | undefined {
        const existing = this.propertyDescriptions.get(element);
        if (existing) {
            return existing;
        }
        const value = callback(element);
        this.propertyDescriptions.set(element, value);
        return value;
    }

    getPossibleExpectations(element: GrammarAST.AbstractElement, callback: (element: GrammarAST.AbstractElement) => ValueExpectation[]): ValueExpectation[] {
        const existing = this.possibleExpectations.get(element);
        if (existing) {
            return existing;
        }
        const value = callback(element);
        this.possibleExpectations.set(element, value);
        return value;
    }

}