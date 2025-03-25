/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CstUtils, type Grammar } from 'langium';
import { EOL } from 'langium/generate';
import * as _ from 'lodash';
import type { AbstractElement, AbstractRule, TerminalRule } from '../../../langium/lib/languages/generated/ast.js';
import {
    isAction, isAlternatives, isAssignment, isCrossReference, isGroup, isKeyword, isParserRule, isRegexToken,
    isRuleCall, isTerminalAlternatives, isTerminalGroup, isTerminalRule, isTerminalRuleCall
} from '../../../langium/lib/languages/generated/ast.js';

export function generateBnf(grammars: Grammar[], options: GeneratorOptions = { dialect: 'GBNF' }): string {
    const grammarsWithName = grammars.filter(grammar => !!grammar.name);

    const ctx: GeneratorContext = {
        rootAssigned: options.dialect === 'EBNF',
        hasHiddenRules: grammarsWithName.some(grammar => grammar.rules.some(rule => isTerminalRule(rule) && rule.hidden)),
        dialect: options.dialect,
        commentStyle: options.commentStyle ?? (options.dialect === 'GBNF' ? 'hash' : 'parentheses')
    };

    const hiddenRules: TerminalRule[] = [];

    let result: string = '';
    grammarsWithName.forEach(grammar => {
        grammar.rules.forEach(rule => {
            result += processRule(rule, ctx);
            result += EOL + EOL;
            if (ctx.hasHiddenRules && isTerminalRule(rule) && rule.hidden) {
                hiddenRules.push(rule);
            }
        });
    });

    if (hiddenRules.length > 0) {
        result += `${processName('HIDDEN', ctx)} ::= ( ${hiddenRules.map(rule => processName(rule.name, ctx)).join(' | ')} )${EOL}`;
    }
    return result;
}

function processRule(rule: AbstractRule, ctx: GeneratorContext): string {
    const markRoot = !ctx.rootAssigned && isParserRule(rule) && rule.entry;
    if (markRoot) {
        ctx.rootAssigned = true;
    }

    // GBNF expects 'root' as the root rule name, Lark e.g. expects 'start'.
    const ruleName = processName(markRoot ? 'root' : rule.name, ctx);
    const ruleComment = processComment(rule, ctx);
    const hiddenPrefix = (isTerminalRule(rule) && !rule.hidden) ? hiddenRuleCall(ctx) : '';
    return `${ruleComment}${ruleName} ::= ${hiddenPrefix}${processElement(rule.definition, ctx)}`;
}

function processElement(element: AbstractElement, ctx: GeneratorContext): string {
    const processRecursively = (element: AbstractElement) => {
        return processElement(element, ctx);
    };
    if (isKeyword(element)) {
        return `${hiddenRuleCall(ctx)}"${element.value}"`;
    } else if (isGroup(element) || isTerminalGroup(element)) {
        if (element.cardinality) {
            return `( ${element.elements.map(processRecursively).filter(notEmpty).join(' ')} )${processCardinality(element)}`;
        } else {
            return element.elements.map(processRecursively).filter(notEmpty).join(' ');
        }
    } else if (isAssignment(element)) {
        return processRecursively(element.terminal) + processCardinality(element);
    } else if (isRuleCall(element) || isTerminalRuleCall(element)) {
        return processName(element.rule.ref?.name ?? element.rule.$refText, ctx) + processCardinality(element);
    } else if (isAlternatives(element)) {
        return '(' + element.elements.map(processRecursively).filter(notEmpty).join(' | ') + ')' + processCardinality(element);
    } else if (isRegexToken(element)) {
        // First remove trailing and leading slashes. Replace escaped slashes `\/` with unescaped slashes `/`.
        return element.regex.replace(/(^|[^\\])\//g, (_, p1) => p1 + '').replace(/\\\//g, '/');
    } else if (isCrossReference(element)) {
        return (element.terminal ? processRecursively(element.terminal) : 'ID') + processCardinality(element);
    } else if (isAction(element)) {
        return '';
    } else if (isTerminalAlternatives(element)) {
        return '(' + element.elements.map(processRecursively).filter(notEmpty).join(' | ') + ')';
    }
    console.error(`Not handled AbstractElement type: ${element?.$type}`);
    return `not-handled-(${element?.$type})`;
}

function processCardinality(element: AbstractElement): string {
    return element.cardinality ?? '';
}

function processName(name: string, ctx: GeneratorContext): string {
    switch (ctx.dialect) {
        case 'GBNF':
            // convert camel case to Kebab Case for GBNF (GGML AI)
            return _.kebabCase(name);
        case 'EBNF':
            return `<${name}>`;
        default:
            return name;
    }
}

function processComment(rule: AbstractRule, ctx: GeneratorContext) {
    const comment = CstUtils.findCommentNode(rule.$cstNode, ['ML_COMMENT'])?.text
        ?.replace(/\r?\n|\r/g, ' ') // Replace line breaks
        ?.replace(/^\/\*\s*/, '')   // Remove leading `/*`
        ?.replace(/\s*\*\/$/, '');  // Remove trailing `*/`
    if (comment && comment.trim().length > 0) {
        switch (ctx.commentStyle) {
            case 'skip':
                return ' ';
            case 'parentheses':
                return `(* ${comment} *)${EOL}`;
            case 'slash':
                return `/* ${comment} */${EOL}`;
            case 'hash':
                return `# ${comment}${EOL}`;
        }
    }
    return '';
}

/**
 * Generates a call to the `HIDDEN` rule with a trailing space, if there are hidden rules in the grammar.
 * @param ctx GeneratorContext
 * @returns `HIDDEN* ` if there are hidden rules in the grammar.
 */
function hiddenRuleCall(ctx: GeneratorContext): string {
    return ctx.hasHiddenRules ? (processName('HIDDEN', ctx) + '* ') : '';
}

function notEmpty(text: string): boolean {
    return text.trim().length > 0;
}

/**
 * Default: GBNF
 * EBNF doesn't support RegEx terminal rules.
 */
export type BnfDialect = 'GBNF' | 'EBNF';

/**
 * By default, comments are generated according to the dialect.
 * Use this option to force a specific comment style.
 * Use `parentheses` for `(* comment *)`, `slash` for `/* comment *\/`, `hash` for `# comment`
 * and `skip` to disable comment generation.
 */
export type CommentStyle = 'skip' | 'parentheses' | 'slash' | 'hash';

export type GeneratorOptions = {
    dialect: BnfDialect;
    commentStyle?: CommentStyle;
};

type GeneratorContext = GeneratorOptions & {
    rootAssigned: boolean;
    hasHiddenRules: boolean;
    commentStyle: CommentStyle;
};
