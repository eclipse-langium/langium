/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TokenType } from 'chevrotain';
import { AbstractElement, Action, Alternatives, CrossReference, Grammar, Group, isAction, isAlternatives, isAssignment, isCrossReference, isGroup, isKeyword, isParserRule, isRuleCall, isTerminalRule, isUnorderedGroup, Keyword, ParserRule, RuleCall, UnorderedGroup } from '../grammar/generated/ast';
import { Cardinality, getTypeName, isArrayOperator, isDataTypeRule } from '../grammar/grammar-util';
import { LangiumServices } from '../services';
import { hasContainerOfType, streamAllContents } from '../utils/ast-util';
import { stream } from '../utils/stream';
import { DatatypeSymbol, LangiumParser } from './langium-parser';

type RuleContext = {
    optional: number,
    consume: number,
    subrule: number,
    many: number,
    or: number
} & ParserContext;

type ParserContext = {
    parser: LangiumParser
    tokens: Map<string, TokenType>
    rules: Map<string, Method>
}

type Method = () => void;

export function createLangiumParser(services: LangiumServices): LangiumParser {
    const grammar = services.Grammar;
    const tokens = new Map<string, TokenType>();
    const buildTokens = services.parser.TokenBuilder.buildTokens(grammar);
    buildTokens.forEach(e => {
        tokens.set(e.name, e);
    });
    const rules = new Map<string, Method>();
    const parser = new LangiumParser(services, buildTokens);
    const parserContext: ParserContext = {
        parser,
        tokens,
        rules
    };
    buildParserRules(parserContext, grammar);
    parser.finalize();
    return parser;
}

function getRule(ctx: ParserContext, name: string): Method {
    const rule = ctx.rules.get(name);
    if (!rule) throw new Error(`Rule "${name}" not found."`);
    return rule;
}

function getToken(ctx: ParserContext, name: string): TokenType {
    const token = ctx.tokens.get(name);
    if (!token) throw new Error(`Token "${name}" not found."`);
    return token;
}

function buildParserRules(parserContext: ParserContext, grammar: Grammar): void {
    for (const rule of stream(grammar.rules).filter(isParserRule)) {
        const ctx: RuleContext = {
            ...parserContext,
            consume: 1,
            optional: 1,
            subrule: 1,
            many: 1,
            or: 1
        };
        const method = (rule.entry ? ctx.parser.MAIN_RULE : ctx.parser.DEFINE_RULE).bind(ctx.parser);
        const type = rule.fragment ? undefined : isDataTypeRule(rule) ? DatatypeSymbol : getTypeName(rule);
        ctx.rules.set(rule.name, method(rule.name, type, buildRuleContent(ctx, rule)));
    }
}

function buildRuleContent(ctx: RuleContext, rule: ParserRule): () => unknown {
    const method = buildElement(ctx, rule.alternatives);
    const arrays: string[] = [];
    streamAllContents(rule.alternatives).forEach(e => {
        const item = e.node;
        if (isAssignment(item) && isArrayOperator(item.operator)) {
            arrays.push(item.feature);
        }
    });
    return () => {
        ctx.parser.initializeElement(arrays);
        method();
        return ctx.parser.construct();
    };
}

function buildElement(ctx: RuleContext, element: AbstractElement): Method {
    let method: Method;
    if (isKeyword(element)) {
        method = buildKeyword(ctx, element);
    } else if (isAction(element)) {
        method = buildAction(ctx, element);
    } else if (isAssignment(element)) {
        method = buildElement(ctx, element.terminal);
    } else if (isCrossReference(element)) {
        method = buildCrossReference(ctx, element);
    } else if (isRuleCall(element)) {
        method = buildRuleCall(ctx, element);
    } else if (isAlternatives(element)) {
        method = buildAlternatives(ctx, element);
    } else if (isUnorderedGroup(element)) {
        method = buildUnorderedGroup(ctx, element);
    } else if (isGroup(element)) {
        method = buildGroup(ctx, element);
    } else {
        throw new Error();
    }
    return wrap(ctx, method, element.cardinality);
}

function buildRuleCall(ctx: RuleContext, ruleCall: RuleCall): Method {
    const rule = ruleCall.rule.ref;
    if (isParserRule(rule)) {
        const idx = ctx.subrule++;
        if (hasContainerOfType(ruleCall, isAssignment) || isDataTypeRule(rule)) {
            return () => ctx.parser.subrule(idx, getRule(ctx, rule.name), ruleCall);
        } else {
            return () => ctx.parser.unassignedSubrule(idx, getRule(ctx, rule.name), ruleCall);
        }
    } else if (isTerminalRule(rule)) {
        const idx = ctx.consume++;
        const method = getToken(ctx, rule.name);
        return () => ctx.parser.consume(idx, method, ruleCall);
    } else {
        throw new Error();
    }
}

function buildAlternatives(ctx: RuleContext, alternatives: Alternatives): Method {
    if (alternatives.elements.length === 1) {
        return buildElement(ctx, alternatives.elements[0]);
    } else {
        const methods: Method[] = [];

        for (const element of alternatives.elements) {
            methods.push(buildElement(ctx, element));
        }

        const idx = ctx.or++;
        return () => ctx.parser.alternatives(idx, methods);
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildUnorderedGroup(ctx: RuleContext, group: UnorderedGroup): Method {
    throw new Error('Unordered groups are not supported (yet)');
}

function buildGroup(ctx: RuleContext, group: Group): Method {
    const methods: Method[] = [];

    for (const element of group.elements) {
        methods.push(buildElement(ctx, element));
    }

    return () => methods.forEach(e => e());
}

function buildAction(ctx: RuleContext, action: Action): Method {
    return () => ctx.parser.action(action.type, action);
}

function buildCrossReference(ctx: RuleContext, crossRef: CrossReference): Method {
    const terminal = crossRef.terminal;
    if (!terminal) {
        const idx = ctx.consume++;
        const idToken = getToken(ctx, 'ID');
        return () => ctx.parser.consume(idx, idToken, crossRef);
    } else if (isRuleCall(terminal) && isParserRule(terminal.rule.ref)) {
        const idx = ctx.subrule++;
        const name = terminal.rule.ref.name;
        return () => ctx.parser.subrule(idx, getRule(ctx, name), crossRef);
    } else if (isRuleCall(terminal) && isTerminalRule(terminal.rule.ref)) {
        const idx = ctx.consume++;
        const terminalRule = getToken(ctx, terminal.rule.ref.name);
        return () => ctx.parser.consume(idx, terminalRule, crossRef);
    } else {
        throw new Error();
    }
}

function buildKeyword(ctx: RuleContext, keyword: Keyword): Method {
    const idx = ctx.consume++;
    const token = ctx.tokens.get(keyword.value);
    if (!token) {
        throw new Error();
    }
    return () => ctx.parser.consume(idx, token, keyword);
}

function wrap(ctx: RuleContext, method: Method, cardinality: Cardinality): Method {
    if (!cardinality) {
        return method;
    } else if (cardinality === '*') {
        const idx = ctx.many++;
        return () => ctx.parser.many(idx, method);
    } else if (cardinality === '+') {
        const idx = ctx.many++;
        return () => ctx.parser.atLeastOne(idx, method);
    } else if (cardinality === '?') {
        const idx = ctx.optional++;
        return () => ctx.parser.optional(idx, method);
    } else {
        throw new Error();
    }
}
