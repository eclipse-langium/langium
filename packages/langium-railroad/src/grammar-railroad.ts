/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { GrammarAST, GrammarUtils } from 'langium';
import { expandToStringLF, expandToStringLFWithNL } from 'langium/generate';
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

function styling(options?: GrammarDiagramOptions) {
    return expandToStringLF`
        <style>
            ${defaultCss}
        </style>
        ${options?.css ? expandToStringLF`
                <style>
                    ${options.css.trim()}
                </style>
            ` : ''}
    `;
}

/**
 * Creates a whole HTML file that contains all railroad diagrams.
 *
 * @param grammar
 * @param options
 * Use to add additional styling to all diagrams and additional behavior for the created HTML.
 *
 * @returns A complete HTML document containing all diagrams.
 */
export function createGrammarDiagramHtml(rules: GrammarAST.ParserRule[], options?: GrammarDiagramOptions): string {
    return expandToStringLFWithNL`
        <!DOCTYPE HTML>
        <html>
        <head>
        ${styling(options)}${options?.javascript ? `
        <script>
        ${options.javascript}
        </script>` : ''}
        </head>
        <body>
        ${createGrammarDiagram(rules)}
        </body>
        </html>
    `;
}

/**
 * Creates a standalone SVG diagram for each non-terminal of grammar.
 *
 * @param grammar
 * @param options
 * Use to add additional styling to all diagrams.
 *
 * @returns diagrams
 * For the rule named 'NonTerminal', diagrams.get('NonTerminal') has its SVG content.
 */
export function createGrammarDiagramSvg(rules: GrammarAST.ParserRule[], options?: GrammarDiagramOptions): Map<string, string> {
    const diagrams = new Map<string, string>();
    for (const nonTerminal of rules) {
        diagrams.set(nonTerminal.name, createRuleDiagramSvg(nonTerminal, options));
    }
    return diagrams;
}

/**
 * Creates a standalone SVG diagram for a single non-terminal.
 *
 * @param rule
 * @param options
 * Use to add additional styling to the diagram.
 *
 * @returns The SVG content of the diagram, including its styling.
 */
export function createRuleDiagramSvg(rule: GrammarAST.ParserRule, options?: GrammarDiagramOptions): string {
    const ruleDiagram = new rr.Diagram(toRailroad(rule.definition));
    ruleDiagram.attrs.xmlns = 'http://www.w3.org/2000/svg';
    ruleDiagram.children =
        ruleDiagram.children.concat(styling(options));
    return ruleDiagram.toString();
}

export function createGrammarDiagram(rules: GrammarAST.ParserRule[]): string {
    const text: string[] = [];
    for (const nonTerminal of rules) {
        text.push('<h2 class="non-terminal-name">', nonTerminal.name, '</h2>', '\n', createRuleDiagram(nonTerminal));
    }
    return text.join('');
}

function createRuleDiagram(rule: GrammarAST.ParserRule): string {
    const diagram = new rr.Diagram(toRailroad(rule.definition));
    return diagram.toString();
}

function toRailroad(element: GrammarAST.AbstractElement): FakeSVG[] {
    if (GrammarAST.isAssignment(element)) {
        return wrapCardinality(element.cardinality, toRailroad(element.terminal));
    } else if (GrammarAST.isAlternatives(element)) {
        return wrapCardinality(element.cardinality, toChoice(element.elements));
    } else if (GrammarAST.isUnorderedGroup(element)) {
        const choice = toChoice(element.elements);
        const repetition = choice.map(c => new rr.ZeroOrMore(c));
        return wrapCardinality(element.cardinality, repetition);
    } else if (GrammarAST.isGroup(element)) {
        return wrapCardinality(element.cardinality, new rr.Sequence(element.elements.flatMap(e => toRailroad(e))));
    } else if (GrammarAST.isKeyword(element)) {
        return wrapCardinality(element.cardinality, new rr.Terminal(element.value));
    } else if (GrammarAST.isRuleCall(element)) {
        return wrapCardinality(element.cardinality, new rr.NonTerminal(element.rule?.$refText ?? 'UNKNOWN'));
    } else if (GrammarAST.isCrossReference(element)) {
        if (GrammarAST.isKeyword(element.terminal)) {
            return wrapCardinality(element.cardinality, new rr.Terminal(element.terminal.value));
        } else if (GrammarAST.isRuleCall(element.terminal)) {
            return wrapCardinality(element.cardinality, new rr.NonTerminal(element.terminal.rule?.$refText ?? 'UNKNOWN'));
        } else {
            const nameAssignment = element.type?.ref && GrammarUtils.findNameAssignment(element.type.ref);
            // A name that is a cross-reference itself (e.g. `A: name=[A];`) would lead to an endless recursion.
            // The parser doesn't support it either, so it's drawn like a missing name assignment.
            if (nameAssignment && !GrammarAST.isCrossReference(nameAssignment.terminal)) {
                return wrapCardinality(element.cardinality, toRailroad(nameAssignment));
            } else {
                return wrapCardinality(element.cardinality, new rr.NonTerminal('UNKNOWN'));
            }
        }
    } else {
        return [];
    }
}

/**
 * Maps the given elements to a single choice. Elements without a railroad representation (e.g. actions)
 * are drawn as an empty path, so the choice becomes optional. Never creates an empty `Choice`, as
 * `railroad-diagrams` throws for those - this can happen for grammars that are still being written.
 */
function toChoice(elements: GrammarAST.AbstractElement[]): FakeSVG[] {
    let hasEmptyPath = false;
    const items: FakeSVG[] = [];
    for (const element of elements) {
        const item = toRailroad(element);
        if (item.length === 0) {
            hasEmptyPath = true;
        } else {
            items.push(item.length === 1 ? item[0] : new rr.Sequence(item));
        }
    }
    if (items.length === 0) {
        return [];
    }
    const choice = items.length === 1 ? items[0] : new rr.Choice(0, items);
    return wrapCardinality(hasEmptyPath ? '?' : undefined, choice);
}

function wrapCardinality(cardinality: '?' | '*' | '+' | undefined, items: FakeSVG | FakeSVG[]): FakeSVG[] {
    items = Array.isArray(items) ? items : [items];
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
