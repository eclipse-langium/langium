/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import chalk from 'chalk';
import { AstUtils, type Grammar, GrammarAST, GrammarUtils, stream } from 'langium';

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(level: 'log' | 'warn' | 'error', options: { watch?: boolean }, message: string, ...args: any[]): void {
    if (options.watch) {
        console[level](getTime() + message, ...args);
    } else {
        console[level](message, ...args);
    }
}

export function getTime(): string {
    const date = new Date();
    return `[${chalk.gray(`${padZeroes(date.getHours())}:${padZeroes(date.getMinutes())}:${padZeroes(date.getSeconds())}`)}] `;
}

function padZeroes(i: number): string {
    return i.toString().padStart(2, '0');
}

export function collectKeywords(grammar: Grammar): string[] {
    const keywords = new Set<string>();
    const reachableRules = GrammarUtils.getAllReachableRules(grammar, false);

    for (const keyword of stream(reachableRules)
        .filter(rule => GrammarAST.isParserRule(rule) || GrammarAST.isInfixRule(rule))
        .flatMap(rule => AstUtils.streamAllContents(rule).filter(GrammarAST.isKeyword))) {
        keywords.add(keyword.value);
    }

    // Sort keywords by length (longer first) and then alphabetically to make sure
    // highlighting works correctly for keywords that are substrings of other keywords
    // (e.g. 'if' and 'if-def').
    return Array.from(keywords).sort((a, b) => {
        if (a.length === b.length) {
            return a.localeCompare(b);
        }
        return b.length - a.length;
    });
}

export function collectTerminalRegexps(grammar: Grammar): Record<string, RegExp> {
    const result: Record<string, RegExp> = {};
    const reachableRules = GrammarUtils.getAllReachableRules(grammar, false);
    for (const terminalRule of stream(reachableRules).filter(GrammarAST.isTerminalRule)) {
        const name = terminalRule.name;
        const regexp = GrammarUtils.terminalRegex(terminalRule);
        result[name] = regexp;
    }
    return result;
}
