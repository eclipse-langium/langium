/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { getContainerOfType, GrammarAST, streamAllContents } from 'langium';
import { getTypeName } from 'langium/lib/grammar/internal-grammar-util';
import { getPropertyDescriptions, ValueDescriptionMap } from './descriptions';
import { matchDescriptions } from './matching';
import { SerializationContext } from './serialization-cache';
//
// export class CandidateSelector {
//
//     selectNodeStart(node: AstNode, candidates: GrammarAST.AbstractElement[]): GrammarAST.AbstractElement {
//
//     }
//
//     selectNodeCandidates(node: AstNode, entry: GrammarAST.ParserRule): GrammarAST.AbstractElement[] {
//         return [];
//     }
//
// }

export interface NodePath {
    readonly entry: GrammarAST.ParserRule
    readonly items: GrammarAST.AbstractElement[]
    readonly last: GrammarAST.AbstractElement
}

function appendPaths(origin: NodePath, branches: NodePath[]): NodePath[] {
    const paths: NodePath[] = [];
    for (const branch of branches) {
        paths.push({
            entry: origin.entry,
            items: [...origin.items, ...branch.items],
            last: branch.last
        });
    }
    return paths;
}

function replaceLast(path: NodePath, last: GrammarAST.AbstractElement): NodePath {
    return {
        entry: path.entry,
        items: [...path.items.slice(0, path.items.length - 1), last],
        last
    };
}

export function selectNodeStart(context: SerializationContext, values: ValueDescriptionMap, candidates: NodePath[]): NodePath | undefined {
    // In most cases only one path exists
    // We don't need to match descriptions in that case
    if (candidates.length === 1) {
        return candidates[0];
    }
    let max = -1;
    let bestCandidate: NodePath | undefined;
    for (const candidate of candidates) {
        const candidateDescriptions = getPropertyDescriptions(context, candidate.last);
        if (candidateDescriptions) {
            const score = matchDescriptions(context, values, candidateDescriptions);
            if (score > max) {
                max = score;
                bestCandidate = candidate;
            }
        }
    }
    return bestCandidate;
}

export function selectNodeCandidates(context: SerializationContext, type: string, entry: GrammarAST.ParserRule): NodePath[] {
    return context.cache.getNodeCandidates(type, entry, (type, rule) => selectNodeCandidatesInternal(context, type, rule));
}

export function selectNodeCandidatesInternal(context: SerializationContext, type: string, entry: GrammarAST.ParserRule): NodePath[] {
    const reachableElements = context.cache.getReachableCandidates(entry, rule => findReachableElements(rule, new Set()));
    const candidates: NodePath[] = [];
    for (const element of reachableElements) {
        const last = element.last;
        if (GrammarAST.isAction(last)) {
            const actionType = getTypeName(last);
            const container = last.$container;
            if (type === actionType && GrammarAST.isAbstractElement(container)) {
                candidates.push(replaceLast(element, container));
            }
        } else {
            const container = getContainerOfType(last, GrammarAST.isParserRule);
            if (container) {
                const ruleType = getTypeName(container);
                if (type === ruleType) {
                    candidates.push(element);
                }
            }
        }
    }
    return candidates;
}

function findReachableElements(entry: GrammarAST.ParserRule, visited: Set<GrammarAST.ParserRule>): NodePath[] {
    if (visited.has(entry)) {
        return [];
    } else {
        visited.add(entry);
    }
    const allContent = streamAllContents(entry);
    const allActions = allContent.filter(GrammarAST.isAction).toArray();
    const allUnassignedRuleCalls = allContent
        .filter(GrammarAST.isRuleCall)
        .filter(e => !(!!getContainerOfType(e, GrammarAST.isAssignment) || e.rule.ref!.fragment))
        .toArray();

    const entryPath: NodePath = {
        entry,
        items: [entry.definition],
        last: entry.definition
    };

    const elements: NodePath[] = [
        entryPath,
        ...allActions.map(e => ({
            entry,
            items: [e],
            last: e
        }))
    ];

    for (const ruleCall of allUnassignedRuleCalls) {
        const rule = ruleCall.rule.ref!;
        if (GrammarAST.isParserRule(rule)) {
            elements.push(...appendPaths(entryPath, findReachableElements(rule, visited)));
        }
    }
    return elements;
}
