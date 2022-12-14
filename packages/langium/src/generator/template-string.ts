/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EOL, toString } from './generator-node';

export function expandToStringWithNL(staticParts: TemplateStringsArray, ...substitutions: unknown[]): string {
    return expandToString(staticParts, ...substitutions) + EOL;
}

/**
 * A tag function that automatically aligns embedded multiline strings.
 *
 * @param staticParts the static parts of a tagged template literal
 * @param substitutions the variable parts of a tagged template literal
 * @returns an aligned string that consists of the given parts
 */
export function expandToString(staticParts: TemplateStringsArray, ...substitutions: unknown[]): string {
    let lines = substitutions                        // align substitutions and fuse them with static parts
        .reduce((acc: string, subst: unknown, i: number) => acc + (subst === undefined ? SNLE : align(toString(subst), acc)) + (staticParts[i + 1] ?? ''), staticParts[0])
        .split(EOL)                                  // converts text to lines
        .filter(l => l.trim() !== SNLE)
        .map(l => l.replace(SNLE, '').trimRight());  // whitespace-only lines are empty (preserving leading whitespace)

    // in order to nicely handle single line templates with the leading and trailing termintators (``) on separate lines, like
    //   expandToString`foo
    //   `,
    //   expandToString`
    //      foo
    //   `,
    //   expandToString`
    //      foo`,
    // the same way as true single line templates like
    //   expandToString`foo`
    // ...

    // ... drop initial linebreak if the first line is empty or contains white space only, ...
    const containsLeadingLinebreak = lines.length > 1 && lines[0].trim().length === 0;
    lines = containsLeadingLinebreak ? lines.slice(1) : lines;

    // .. and drop the last linebreak if it's the last charactor or is followed by white space
    const containsTrailingLinebreak = lines.length !== 0 && lines[lines.length-1].trimRight().length === 0;
    lines = containsTrailingLinebreak ? lines.slice(0, lines.length-1) : lines;

    const indent = findIndentation(lines);           // finds the minimum indentation
    return lines
        .map(line => line.slice(indent).trimRight()) // shifts lines to the left
        .join('\n');                                 // convert lines to string
}

export const SNLE = Object.freeze('__«SKIP^NEW^LINE^IF^EMPTY»__');
const newline = new RegExp(EOL, 'g');
const nonWhitespace = /\S|$/;

// add the alignment of the previous static part to all lines of the following substitution
function align(subst: string, acc: string): string {
    const length = Math.max(0, acc.length - acc.lastIndexOf('\n') - 1);
    const indent = ' '.repeat(length);
    return subst.replace(newline, EOL + indent);
}

// finds the indentation of a text block represented by a sequence of lines
export function findIndentation(lines: string[]): number {
    const indents = lines.filter(line => line.length > 0).map(line => line.search(nonWhitespace));
    const min = indents.length === 0 ? 0 : Math.min(...indents); // min(...[]) = min() = Infinity
    return Math.max(0, min);
}
