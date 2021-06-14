/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

const leadingWhitespace = /^(s*\n)+/;
const newline = /\n/g;
const nonWhitespace = /\S|$/;

/**
 * A tag function that automatically aligns embedded multiline strings.
 *
 * @param staticParts the static parts of a tagged template literal
 * @param substitutions the variable parts of a tagged template literal
 * @returns an aligned string that consists of the given parts
 */
export function s(staticParts: TemplateStringsArray, ...substitutions: unknown[]): string {
    const lines = substitutions                      // align substitutions and fuse them with static parts
        .reduce((acc: string, subst, i) => acc + align(String(subst), acc) + staticParts[i + 1], staticParts[0])
        .split('\n')                                 // converts text to lines
        .map(line => line.trimRight());              // whitespace-only lines are empty (preserving leading whitespace)
    const indent = findIndentation(lines);           // finds the minimum indentation
    return lines
        .map(line => line.slice(indent).trimRight()) // shifts lines to the left
        .join('\n')                                  // convert lines to string
        .trimRight()                                 // removes trailing whitespace after joining possibly empty lines
        .replace(leadingWhitespace, '');             // removes leading whitespace while preserving indentation
}

// add the alignment of the previous static part to all lines of the following substitution
function align(subst: string, acc: string): string {
    const length = Math.max(0, acc.length - acc.lastIndexOf('\n') - 1);
    const indent = ' '.repeat(length);
    return subst.replace(newline, '\n' + indent);
}

// finds the indentation of a text block represented by a sequence of lines
function findIndentation(lines: string[]): number {
    const indents = lines.filter(line => line.length > 0).map(line => line.search(nonWhitespace));
    const min = indents.length === 0 ? 0 : Math.min(...indents); // min(...[]) = min() = Infinity
    return Math.max(0, min);
}
