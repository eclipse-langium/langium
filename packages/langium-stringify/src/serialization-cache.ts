/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstReflection, GrammarAST } from 'langium';
import type { NodePath } from './candidate-selector';
import type { ItemDescription } from './descriptions';
import type { ValueExpectation } from './matching';

export interface SerializationContext {
    cache: SerializationCache
    reflection: AstReflection
}

export class SerializationCache {

    protected reachableCandidates = new Map<GrammarAST.ParserRule, NodePath[]>();
    protected nodeCandidates = new Map<string, NodePath[]>();
    protected propertyDescriptions = new Map<GrammarAST.AbstractElement, ItemDescription | undefined>();
    protected possibleExpectations = new Map<GrammarAST.AbstractElement, ValueExpectation[]>();

    getReachableCandidates(rule: GrammarAST.ParserRule, callback: (rule: GrammarAST.ParserRule) => NodePath[]): NodePath[] {
        return this.get(this.reachableCandidates, rule, callback);
    }

    getNodeCandidates(type: string, rule: GrammarAST.ParserRule, callback: (type: string, rule: GrammarAST.ParserRule) => NodePath[]): NodePath[] {
        return this.get(
            this.nodeCandidates,
            [type, rule] as const,
            ([type, rule]) => callback(type, rule),
            ([type, rule]) => type + ':' + rule.name
        );
    }

    getPropertyDescriptions(element: GrammarAST.AbstractElement, callback: (element: GrammarAST.AbstractElement) => ItemDescription | undefined): ItemDescription | undefined {
        return this.get(this.propertyDescriptions, element, callback);
    }

    getPossibleExpectations(element: GrammarAST.AbstractElement, callback: (element: GrammarAST.AbstractElement) => ValueExpectation[]): ValueExpectation[] {
        return this.get(this.possibleExpectations, element, callback);
    }

    protected get<T, V, K>(map: Map<K, V>, item: T, valueGenerator: (item: T) => V, keyGenerator?: (item: T) => K): V {
        const key = keyGenerator ? keyGenerator(item) : item as unknown as K;
        const existing = map.get(key);
        if (existing) {
            return existing;
        }
        const value = valueGenerator(item);
        map.set(key, value);
        return value;
    }
}