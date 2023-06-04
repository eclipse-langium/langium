/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { GrammarAST, findNameAssignment } from 'langium';
import * as railroad from 'railroad-diagrams';

export function createGrammarDiagramHtml(grammar: GrammarAST.Grammar): string {
    return createGrammarDiagram(grammar);
}

export function createGrammarDiagram(grammar: GrammarAST.Grammar): string {
    const nonTerminals = grammar.rules.filter(GrammarAST.isParserRule);
    let text = '';
    for (const nonTerminal of nonTerminals) {
        text += '<h2>' + nonTerminal.name + '</h2>';
        text += createRuleDiagram(nonTerminal);
    }
    return text;
}

function createRuleDiagram(rule: GrammarAST.ParserRule): string {
    const diagram = new railroad.Diagram(toRailroad(rule.definition));
    return diagram.toString();
}

function toRailroad(element: GrammarAST.AbstractElement): railroad.FakeSVG[] {
    if (GrammarAST.isAssignment(element)) {
        return wrapCardinality(element.cardinality, toRailroad(element.terminal));
    } else if (GrammarAST.isAlternatives(element)) {
        return wrapCardinality(element.cardinality, [new railroad.Choice(0, element.elements.flatMap(e => toRailroad(e)))]);
    } else if (GrammarAST.isUnorderedGroup(element)) {
        const choice = new railroad.Choice(0, element.elements.flatMap(e => toRailroad(e)));
        const repetition = new railroad.ZeroOrMore(choice);
        return wrapCardinality(element.cardinality, [repetition]);
    } else if (GrammarAST.isGroup(element)) {
        return wrapCardinality(element.cardinality, [new railroad.Sequence(element.elements.flatMap(e => toRailroad(e)))]);
    } else if (GrammarAST.isKeyword(element)) {
        return wrapCardinality(element.cardinality, [new railroad.Terminal(element.value)]);
    } else if (GrammarAST.isRuleCall(element)) {
        return wrapCardinality(element.cardinality, [new railroad.NonTerminal(element.rule.$refText)]);
    } else if (GrammarAST.isCrossReference(element)) {
        if (GrammarAST.isKeyword(element.terminal)) {
            return wrapCardinality(element.cardinality, [new railroad.Terminal(element.terminal.value)]);
        } else if (GrammarAST.isRuleCall(element.terminal)) {
            return wrapCardinality(element.cardinality, [new railroad.NonTerminal(element.terminal.rule.$refText)]);
        } else {
            const nameAssignment = element.type.ref && findNameAssignment(element.type.ref);
            if (nameAssignment) {
                return wrapCardinality(element.cardinality, toRailroad(nameAssignment));
            } else {
                return wrapCardinality(element.cardinality, [new railroad.NonTerminal('UNKNOWN')]);
            }
        }
    } else {
        return [];
    }
}

function wrapCardinality(cardinality: '?' | '*' | '+' | undefined, items: railroad.FakeSVG[]): railroad.FakeSVG[] {
    if (cardinality) {
        if (cardinality === '*') {
            return [new railroad.ZeroOrMore(new railroad.Sequence(items))];
        } else if (cardinality === '+') {
            return [new railroad.OneOrMore(new railroad.Sequence(items))];
        } else if (cardinality === '?') {
            return [new railroad.Optional(new railroad.Sequence(items))];
        }
    }
    return items;
}
