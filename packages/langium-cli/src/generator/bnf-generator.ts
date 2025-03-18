/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import type { AbstractElement, AbstractRule } from '../../../langium/lib/languages/generated/ast.js';
import { isAction, isAlternatives, isAssignment, isCrossReference, isGroup, isKeyword, isParserRule, isRegexToken, isRuleCall } from '../../../langium/lib/languages/generated/ast.js';

export function generateBnf(grammars: Grammar[]): string {
    const grammarsWithName = grammars.filter(grammar => !!grammar.name);
    let result: string = '';
    const ctx: GeneratorContext = {
        rootAssigned: false
    };
    grammarsWithName.forEach(grammar => {
        grammar.rules.filter(rule => !rule.fragment).forEach(rule => {
            result += processRule(rule, ctx);
            result += '\n\n';
        });
    }
    );
    return result;
}

function processRule(rule: AbstractRule, ctx: GeneratorContext): string {
    const markRoot = !ctx.rootAssigned && isParserRule(rule) && rule.entry;
    if (markRoot) {
        ctx.rootAssigned = true;
    }
    return `${markRoot ? 'root' : rule.name} ::= ${processElement(rule.definition)}`;
}

function processElement(element: AbstractElement): string {
    if (isKeyword(element)) {
        return `"${element.value}"`;
    } else if (isGroup(element)) {
        if (element.cardinality) {
            return `(${element.elements.map(processElement).filter(notEmpty).join(' ')})${processCardinality(element)}`;
        } else {
            return element.elements.map(processElement).filter(notEmpty).join(' ');
        }
    } else if (isAssignment(element)) {
        return processElement(element.terminal) + processCardinality(element);
    } else if (isRuleCall(element)) {
        return element.rule.ref?.name ?? element.rule.$refText;
    } else if (isAlternatives(element)) {
        return '(' + element.elements.map(processElement).filter(notEmpty).join(' | ') + ')';
    } else if (isRegexToken(element)) {
        // First remove trailing and leading slashes. Replace escaped slashes `\/` with unescaped slashes `/`.
        return element.regex.replace(/(?<!\\)\//g, '').replace(/\\\//g, '/');
    } else if (isCrossReference(element)) {
        return element.terminal ? processElement(element.terminal) : 'ID';
    } else if (isAction(element)) {
        return '';
    }
    return `not-handled type: ${element.$type}`;
}

function processCardinality(element: AbstractElement): string {
    return element.cardinality ?? '';
}

function notEmpty(text: string): boolean {
    return text.trim().length > 0;
}

type GeneratorContext = {
    rootAssigned: boolean;
};
