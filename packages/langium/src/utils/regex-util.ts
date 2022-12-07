/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { RegExpParser, BaseRegExpVisitor, Set, Group, Character } from 'regexp-to-ast';

const regexParser = new RegExpParser();

class CommentRegexVisitor extends BaseRegExpVisitor {

    private isStarting = true;
    startRegex: string;
    private endRegexStack: string[] = [];
    multiline = false;
    regex: string;

    get endRegex(): string {
        return this.endRegexStack.join('');
    }

    reset(regex: string): void {
        this.multiline = false;
        this.regex = regex;
        this.startRegex = '';
        this.isStarting = true;
        this.endRegexStack = [];
    }

    override visitGroup(node: Group) {
        if (node.quantifier) {
            this.isStarting = false;
            this.endRegexStack = [];
        }
    }

    override visitCharacter(node: Character): void {
        const char = String.fromCharCode(node.value);
        if (!this.multiline && char === '\n') {
            this.multiline = true;
        }
        if (node.quantifier) {
            this.isStarting = false;
            this.endRegexStack = [];
        } else {
            const escapedChar = escapeRegExp(char);
            this.endRegexStack.push(escapedChar);
            if (this.isStarting) {
                this.startRegex += escapedChar;
            }
        }
    }

    override visitSet(node: Set): void {
        if (!this.multiline) {
            const set = this.regex.substring(node.loc.begin, node.loc.end);
            const regex = new RegExp(set);
            this.multiline = Boolean('\n'.match(regex));
        }
        if (node.quantifier) {
            this.isStarting = false;
            this.endRegexStack = [];
        } else {
            const set = this.regex.substring(node.loc.begin, node.loc.end);
            this.endRegexStack.push(set);
            if (this.isStarting) {
                this.startRegex += set;
            }
        }
    }
}

const visitor = new CommentRegexVisitor();

export function getTerminalParts(regex: RegExp | string): Array<{ start: string, end: string }> {
    try {
        if (typeof regex !== 'string') {
            regex = regex.source;
        }
        regex = `/${regex}/`;
        const pattern = regexParser.pattern(regex);
        const parts: Array<{ start: string, end: string }> = [];
        for (const alternative of pattern.value.value) {
            visitor.reset(regex);
            visitor.visit(alternative);
            parts.push({
                start: visitor.startRegex,
                end: visitor.endRegex
            });
        }
        return parts;
    } catch {
        return [];
    }
}

export function isMultilineComment(regex: RegExp | string): boolean {
    try {
        if (typeof regex !== 'string') {
            regex = regex.source;
        }
        regex = `/${regex}/`;
        visitor.reset(regex);
        // Parsing the pattern might fail (since it's user code)
        visitor.visit(regexParser.pattern(regex));
        return visitor.multiline;
    } catch {
        return false;
    }
}

export function isWhitespaceRegExp(value: RegExp | string): boolean {
    const regexp = typeof value === 'string' ? new RegExp(value) : value;
    return regexp.test(' ');
}

export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getCaseInsensitivePattern(keyword: string): string {
    return Array.prototype.map.call(keyword, letter =>
        /\w/.test(letter) ? `[${letter.toLowerCase()}${letter.toUpperCase()}]` : escapeRegExp(letter)
    ).join('');
}

/**
 * Determines whether the given input has a partial match with the specified regex.
 * @param regex The regex to partially match against
 * @param input The input string
 * @returns Whether any match exists.
 */
export function partialMatches(regex: RegExp | string, input: string): boolean {
    const partial = partialRegex(regex);
    const match = input.match(partial);
    return !!match && match[0].length > 0;
}

/**
 * Builds a partial regex from the input regex. A partial regex is able to match incomplete input strings. E.g.
 * a partial regex constructed from `/ab/` is able to match the string `a` without needing a following `b` character. However it won't match `b` alone.
 * @param regex The input regex to be converted.
 * @returns A partial regex constructed from the input regex.
 */
export function partialRegex(regex: RegExp | string): RegExp {
    if (typeof regex === 'string') {
        regex = new RegExp(regex);
    }
    const re = regex, source = regex.source;
    let i = 0;

    function process() {
        let result = '',
            tmp;

        function appendRaw(nbChars: number) {
            result += source.substr(i, nbChars);
            i += nbChars;
        }

        function appendOptional(nbChars: number) {
            result += '(?:' + source.substr(i, nbChars) + '|$)';
            i += nbChars;
        }

        while (i < source.length) {
            switch (source[i]) {
                case '\\':
                    switch (source[i + 1]) {
                        case 'c':
                            appendOptional(3);
                            break;
                        case 'x':
                            appendOptional(4);
                            break;
                        case 'u':
                            if (re.unicode) {
                                if (source[i + 2] === '{') {
                                    appendOptional(source.indexOf('}', i) - i + 1);
                                } else {
                                    appendOptional(6);
                                }
                            } else {
                                appendOptional(2);
                            }
                            break;
                        case 'p':
                        case 'P':
                            if (re.unicode) {
                                appendOptional(source.indexOf('}', i) - i + 1);
                            } else {
                                appendOptional(2);
                            }
                            break;
                        case 'k':
                            appendOptional(source.indexOf('>', i) - i + 1);
                            break;
                        default:
                            appendOptional(2);
                            break;
                    }
                    break;

                case '[':
                    tmp = /\[(?:\\.|.)*?\]/g;
                    tmp.lastIndex = i;
                    tmp = tmp.exec(source) || [];
                    appendOptional(tmp[0].length);
                    break;

                case '|':
                case '^':
                case '$':
                case '*':
                case '+':
                case '?':
                    appendRaw(1);
                    break;
                case '{':
                    tmp = /\{\d+,?\d*\}/g;
                    tmp.lastIndex = i;
                    tmp = tmp.exec(source);
                    if (tmp) {
                        appendRaw(tmp[0].length);
                    } else {
                        appendOptional(1);
                    }
                    break;
                case '(':
                    if (source[i + 1] === '?') {
                        switch (source[i + 2]) {
                            case ':':
                                result += '(?:';
                                i += 3;
                                result += process() + '|$)';
                                break;
                            case '=':
                                result += '(?=';
                                i += 3;
                                result += process() + ')';
                                break;
                            case '!':
                                tmp = i;
                                i += 3;
                                process();
                                result += source.substr(tmp, i - tmp);
                                break;
                            case '<':
                                switch (source[i + 3]) {
                                    case '=':
                                    case '!':
                                        tmp = i;
                                        i += 4;
                                        process();
                                        result += source.substr(tmp, i - tmp);
                                        break;
                                    default:
                                        appendRaw(source.indexOf('>', i) - i + 1);
                                        result += process() + '|$)';
                                        break;
                                }
                                break;
                        }
                    } else {
                        appendRaw(1);
                        result += process() + '|$)';
                    }
                    break;
                case ')':
                    ++i;
                    return result;
                default:
                    appendOptional(1);
                    break;
            }
        }

        return result;
    }

    return new RegExp(process(), regex.flags);
}
