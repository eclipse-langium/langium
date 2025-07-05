/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import chalk from 'chalk';
import { AstUtils, type Grammar, GrammarAST, GrammarUtils, type LangiumDocument, stream } from 'langium';
import * as path from 'path';

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
    const allRules = grammar.rules; // since this grammar might be imported by other grammars, all rules need to be investigated

    for (const keyword of stream(allRules)
        .filter(rule => GrammarAST.isParserRule(rule) || GrammarAST.isInfixRule(rule))
        .flatMap(rule => AstUtils.streamAllContents(rule).filter(GrammarAST.isKeyword))) {
        keywords.add(keyword.value);
    }

    return Array.from(keywords).sort();
}

export function collectTerminalRegexps(grammar: Grammar): Record<string, RegExp> {
    const result: Record<string, RegExp> = {};
    const allRules = grammar.rules; // since this grammar might be imported by other grammars, all rules need to be investigated
    for (const terminalRule of stream(allRules).filter(GrammarAST.isTerminalRule)) {
        const name = terminalRule.name;
        const regexp = GrammarUtils.terminalRegex(terminalRule);
        result[name] = regexp;
    }
    return result;
}

export function getAstIdentifierForGrammarFile(grammar: Grammar): string {
    const doc: LangiumDocument = AstUtils.getDocument(grammar);
    const p1 = doc.uri.fsPath.toLowerCase();
    // use the file name, since not each grammar contains a "grammar XXX"-declaration
    return replaceSpecialSignsForCamelCase(path.basename(p1, '.langium'));
}

export function replaceSpecialSignsForCamelCase(value: string): string {
    return value.split('.').flatMap(p => p.split(' ')).flatMap(p => p.split('-')).flatMap(p => p.split('_')) // replace some signs: . -_
        .map(ensureCamelCase) // camel case for each single part of the value after removing the special signs
        .join('');
}

export function ensureCamelCase(value: string): string {
    if (value.length >= 1 && value[0].toLocaleUpperCase() !== value[0]) {
        return value[0].toLocaleUpperCase() + value.substring(1);
    } else {
        return value;
    }
}
