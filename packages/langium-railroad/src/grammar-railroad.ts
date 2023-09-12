/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { GrammarAST, findNameAssignment } from 'langium';
import type { FakeSVG } from 'railroad-diagrams';
import { default as rr } from 'railroad-diagrams';

export const defaultCss = `
svg.railroad-diagram {
    background-color: hsl(30,20%,95%);
}
svg.railroad-diagram path {
    stroke-width: 3;
    stroke: black;
    fill: rgba(0,0,0,0);
}
svg.railroad-diagram text {
    font: bold 14px monospace;
    text-anchor: middle;
}
svg.railroad-diagram text.label {
    text-anchor: start;
}
svg.railroad-diagram text.comment {
    font: italic 12px monospace;
}
svg.railroad-diagram rect {
    stroke-width: 3;
    stroke: black;
    fill: hsl(120,100%,90%);
}
`.trim();

export interface GrammarDiagramOptions {
    css?: string;
    javascript?: string;
}

/**
 * Creates a whole HTML file that contains all railroad diagrams.
 *
 * @param grammar - GrammarAST.Grammar
 * @param options - GrammarDiagramOptions
 * @returns string
 */
export function createGrammarDiagramHtml(grammar: GrammarAST.Grammar, options?: GrammarDiagramOptions): string {
    let text = `<!DOCTYPE HTML>
<html>
<head>
<style>
${defaultCss}
</style>${options?.css ? `
<style>
${options.css}
</style>` : ''}
${options?.javascript ? `
<script>
${options.javascript}
</script>` : ''}
</head>
<body>
`;
    text += createGrammarDiagram(grammar);
    text += `</body>
</html>`;

    return text;
}

/**
 * Creates a standalone SVG diagram for each non-terminal of grammar.
 * 
 * @param grammar - GrammarAST.Grammar
 * @returns diagrams -Map<string, string>
 * For the rule with the name 'NonTerminal', diagrams.get('NonTerminal') has the SVG content.
 */
export function createGrammarDiagramSvg(grammar: GrammarAST.Grammar): Map<string, string> {
    const nonTerminals = grammar.rules.filter(GrammarAST.isParserRule);
    const diagrams = new Map<string, string>();
    const style = `<style>${defaultCss}</style>`;

    for (const nonTerminal of nonTerminals) {
        const ruleDiagram = new rr.Diagram(toRailroad(nonTerminal.definition));
        ruleDiagram.children =
            ruleDiagram.children.concat(style);
        diagrams.set(nonTerminal.name, ruleDiagram.toString());
    }
    return diagrams;
}

export function createGrammarDiagram(grammar: GrammarAST.Grammar): string {
    const nonTerminals = grammar.rules.filter(GrammarAST.isParserRule);
    let text = '';
    for (const nonTerminal of nonTerminals) {
        text += '<h2>' + nonTerminal.name + '</h2>\n';
        text += createRuleDiagram(nonTerminal);
    }
    return text;
}

function createRuleDiagram(rule: GrammarAST.ParserRule): string {
    const diagram = new rr.Diagram(toRailroad(rule.definition));
    return diagram.toString();
}

function toRailroad(element: GrammarAST.AbstractElement): FakeSVG[] {
    if (GrammarAST.isAssignment(element)) {
        return wrapCardinality(element.cardinality, toRailroad(element.terminal));
    } else if (GrammarAST.isAlternatives(element)) {
        return wrapCardinality(element.cardinality, [new rr.Choice(0, element.elements.flatMap(e => toRailroad(e)))]);
    } else if (GrammarAST.isUnorderedGroup(element)) {
        const choice = new rr.Choice(0, element.elements.flatMap(e => toRailroad(e)));
        const repetition = new rr.ZeroOrMore(choice);
        return wrapCardinality(element.cardinality, [repetition]);
    } else if (GrammarAST.isGroup(element)) {
        return wrapCardinality(element.cardinality, [new rr.Sequence(element.elements.flatMap(e => toRailroad(e)))]);
    } else if (GrammarAST.isKeyword(element)) {
        return wrapCardinality(element.cardinality, [new rr.Terminal(element.value)]);
    } else if (GrammarAST.isRuleCall(element)) {
        return wrapCardinality(element.cardinality, [new rr.NonTerminal(element.rule.$refText)]);
    } else if (GrammarAST.isCrossReference(element)) {
        if (GrammarAST.isKeyword(element.terminal)) {
            return wrapCardinality(element.cardinality, [new rr.Terminal(element.terminal.value)]);
        } else if (GrammarAST.isRuleCall(element.terminal)) {
            return wrapCardinality(element.cardinality, [new rr.NonTerminal(element.terminal.rule.$refText)]);
        } else {
            const nameAssignment = element.type.ref && findNameAssignment(element.type.ref);
            if (nameAssignment) {
                return wrapCardinality(element.cardinality, toRailroad(nameAssignment));
            } else {
                return wrapCardinality(element.cardinality, [new rr.NonTerminal('UNKNOWN')]);
            }
        }
    } else {
        return [];
    }
}

function wrapCardinality(cardinality: '?' | '*' | '+' | undefined, items: FakeSVG[]): FakeSVG[] {
    if (cardinality) {
        if (cardinality === '*') {
            return [new rr.ZeroOrMore(new rr.Sequence(items))];
        } else if (cardinality === '+') {
            return [new rr.OneOrMore(new rr.Sequence(items))];
        } else if (cardinality === '?') {
            return [new rr.Optional(new rr.Sequence(items))];
        }
    }
    return items;
}
