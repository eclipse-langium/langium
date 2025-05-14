/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CstUtils, type Grammar } from 'langium';
import { EOL } from 'langium/generate';
import _ from 'lodash';
import type { AbstractElement, AbstractRule, Condition, InfixRule, NamedArgument, Parameter } from '../../../langium/lib/languages/generated/ast.js';
import {
    isAction, isAlternatives, isAssignment,
    isCrossReference, isGroup, isInfixRule, isKeyword,
    isParserRule, isRegexToken,
    isRuleCall, isTerminalAlternatives, isTerminalGroup, isTerminalRule, isTerminalRuleCall
} from '../../../langium/lib/languages/generated/ast.js';

export function generateBnf(grammars: Grammar[], options: GeneratorOptions = { dialect: 'GBNF' }): string {
    const grammarsWithName = grammars.filter(grammar => !!grammar.name);

    const isHiddenTerminalRule = (rule: AbstractRule): boolean => {
        return isTerminalRule(rule) && rule.hidden;
    };

    const ctx: GeneratorContext = {
        rootAssigned: options.dialect === 'EBNF',
        hasHiddenRules: grammarsWithName.some(grammar => grammar.rules.some(isHiddenTerminalRule)),
        dialect: options.dialect,
        commentStyle: options.commentStyle ?? (options.dialect === 'GBNF' ? 'hash' : 'parentheses')
    };

    const hiddenRules: AbstractRule[] = [];

    let result: string = '';
    grammarsWithName.forEach(grammar => {
        grammar.rules.forEach(rule => {
            result += processRule(rule, ctx);
            result += EOL + EOL;
            if (isHiddenTerminalRule(rule)) {
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
    const ruleComment = processComment(rule, ctx);
    const hiddenPrefix = (isTerminalRule(rule) && !rule.hidden) ? hiddenRuleCall(ctx) : '';
    const ruleName = markRoot ? 'root' : rule.name;
    if (isParserRule(rule) && rule.parameters.length > 0) {
        // parser rule with parameters
        const variations: Array<Record<string, boolean>> = parserRuleVariations(rule.parameters);
        let content = '';
        variations.forEach((variation, idx) => {
            const variationCtx = { ...ctx, parserRuleVariation: variation };
            content += `${ruleComment}${processName(ruleName, variationCtx, variation)} ::= ${hiddenPrefix}${processElement(rule.definition, variationCtx)}`;
            if (idx < variations.length - 1) {
                content += EOL;
            }
        });
        return content;
    }
    if (isInfixRule(rule)) {
        return `${ruleComment}${processName(ruleName, ctx)} ::= ${hiddenPrefix}${processInfix(rule, ctx)}`;
    } else {
        return `${ruleComment}${processName(ruleName, ctx)} ::= ${hiddenPrefix}${processElement(rule.definition, ctx)}`;
    }
}

function processInfix(rule: InfixRule, ctx: GeneratorContext): string {
    const infixRuleName = processName(rule.name, ctx);
    const variation = collectArguments(rule.call.rule.ref, rule.call.arguments, ctx);
    const ruleName = rule.call.rule.ref?.name ?? rule.call.rule.$refText;
    const call = processName(ruleName, ctx, variation);
    const operators = rule.operators.precedences.flatMap(prec => prec.operators.map(op => `"${op.value}"`));
    const allOperators = `(${operators.join(' | ')})`;
    return `${infixRuleName} ::= ${call} (${allOperators} ${call})*`;
}

function processElement(element: AbstractElement, ctx: GeneratorContext): string {
    const processRecursively = (element: AbstractElement) => {
        return processElement(element, ctx);
    };
    if (isKeyword(element)) {
        return `${hiddenRuleCall(ctx)}"${element.value}"`;
    } else if (isGroup(element) || isTerminalGroup(element)) {
        if (isGroup(element) && element.guardCondition && !evaluateCondition(element.guardCondition, ctx)) {
            // Skip group if guard condition is false
            return ' ';
        }
        const content = element.elements.map(processRecursively).filter(notEmpty).join(' ');
        if (element.cardinality && notEmpty(content)) {
            return `( ${content} )${processCardinality(element)}`;
        }
        return content;
    } else if (isAssignment(element)) {
        return processRecursively(element.terminal) + processCardinality(element);
    } else if (isRuleCall(element) || isTerminalRuleCall(element)) {
        const variation = isRuleCall(element) ? collectArguments(element.rule.ref, element.arguments, ctx) : undefined;
        const ruleName = element.rule.ref?.name ?? element.rule.$refText;
        return processName(ruleName, ctx, variation) + processCardinality(element);
    } else if (isAlternatives(element) || isTerminalAlternatives(element)) {
        const content = element.elements.map(processRecursively).filter(notEmpty).join(' | ');
        if (notEmpty(content)) {
            return '(' + content + ')' + processCardinality(element);
        }
        return '';
    } else if (isRegexToken(element)) {
        // First remove trailing and leading slashes. Replace escaped slashes `\/` with unescaped slashes `/`.
        return element.regex.replace(/(^|[^\\])\//g, (_, p1) => p1 + '').replace(/\\\//g, '/');
    } else if (isCrossReference(element)) {
        return (element.terminal ? processRecursively(element.terminal) : 'ID') + processCardinality(element);
    } else if (isAction(element)) {
        return '';
    }
    console.error(`Not handled AbstractElement type: ${element?.$type}`);
    return `not-handled-(${element?.$type})`;
}

function processCardinality(element: AbstractElement): string {
    return element.cardinality ?? '';
}

function processName(ruleName: string, ctx: GeneratorContext, parserRuleVariation?: Record<string, boolean>): string {
    const name = parserRuleVariation
        ? `${ruleName}${Object.entries(parserRuleVariation)
            .filter(entry => entry[1]).map(entry => entry[0].charAt(0).toUpperCase() + entry[0].slice(1))
            .join('')}`
        : ruleName;
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
 * @param params parserRule parameters
 * @returns all possible combination of guards for the parserRule - 2^params.length
 */
function parserRuleVariations(params: Parameter[]): Array<Record<string, boolean>> {
    const variationsCount = Math.pow(2, params.length);
    const variations: Array<Record<string, boolean>> = [];
    for (let i = 0; i < variationsCount; i++) {
        const variation: Record<string, boolean> = {};
        params.map((param, index) => {
            // eslint-disable-next-line no-bitwise
            const isTrue = (i & (1 << index)) !== 0;
            return variation[param.name] = isTrue;
        });
        variations.push(variation);
    }
    return variations;
}

function collectArguments(rule: AbstractRule | undefined, namedArgs: NamedArgument[], ctx: GeneratorContext): Record<string, boolean> | undefined {
    if (isParserRule(rule) && namedArgs.length > 0 && rule.parameters.length === namedArgs.length) {
        const variation: Record<string, boolean> = {};
        namedArgs.forEach((arg, idx) => {
            variation[rule.parameters[idx].name] = evaluateCondition(arg.value, ctx);
        });
        return variation;
    }
    return undefined;
}

function evaluateCondition(condition: Condition, ctx: GeneratorContext): boolean {
    switch (condition.$type) {
        case 'BooleanLiteral':
            return condition.true;
        case 'Conjunction':
            return evaluateCondition(condition.left, ctx) && evaluateCondition(condition.right, ctx);
        case 'Disjunction':
            return evaluateCondition(condition.left, ctx) || evaluateCondition(condition.right, ctx);
        case 'Negation':
            return !evaluateCondition(condition.value, ctx);
        case 'ParameterReference': {
            if (!ctx.parserRuleVariation) {
                return false;
            }
            return ctx.parserRuleVariation[condition.parameter.ref?.name ?? condition.parameter.$refText];
        }
        default:
            throw new Error(`Unhandled Condition type: ${(condition as Condition).$type}`);
    }
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
    parserRuleVariation?: Record<string, boolean>;
};

