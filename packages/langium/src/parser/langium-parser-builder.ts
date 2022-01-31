/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IOrAlt, TokenType, TokenVocabulary } from 'chevrotain';
import { AbstractElement, Action, Alternatives, Condition, CrossReference, Grammar, Group, isAction, isAlternatives, isAssignment, isConjunction, isCrossReference, isDisjunction, isGroup, isKeyword, isLiteralCondition, isNegation, isParameterReference, isParserRule, isRuleCall, isTerminalRule, isUnorderedGroup, Keyword, NamedArgument, ParserRule, RuleCall, UnorderedGroup } from '../grammar/generated/ast';
import { Cardinality, findNameAssignment, getTypeName, isArrayOperator, isDataTypeRule } from '../grammar/grammar-util';
import { LangiumServices } from '../services';
import { hasContainerOfType, isIMultiModeLexerDefinition, isTokenTypeDictionary, streamAllContents } from '../utils/ast-util';
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
    rules: Map<string, Rule>
}

type Rule = () => unknown;

type Args = Record<string, boolean>;

type Predicate = (args: Args) => boolean;

type Method = (args: Args) => void;

/**
 * Create and finalize a Langium parser. The parser rules are derived from the grammar, which is
 * available at `services.Grammar`.
 */
export function createLangiumParser(services: LangiumServices): LangiumParser {
    const parser = prepareLangiumParser(services);
    parser.finalize();
    return parser;
}

/**
 * Create a Langium parser without finalizing it. This is used to extract more detailed error
 * information when the parser is initially validated.
 */
export function prepareLangiumParser(services: LangiumServices): LangiumParser {
    const grammar = services.Grammar;
    const tokens = new Map<string, TokenType>();
    const buildTokens = services.parser.TokenBuilder.buildTokens(grammar, { caseInsensitive: services.LanguageMetaData.caseInsensitive });
    toTokenTypeArray(buildTokens).forEach(e => tokens.set(e.name, e));

    const rules = new Map<string, Rule>();
    const parser = new LangiumParser(services, buildTokens);
    const parserContext: ParserContext = {
        parser,
        tokens,
        rules
    };
    buildParserRules(parserContext, grammar);
    return parser;
}

function toTokenTypeArray(buildTokens: TokenVocabulary): TokenType[] {
    if (isTokenTypeDictionary(buildTokens)) return Object.values(buildTokens);
    if (isIMultiModeLexerDefinition(buildTokens)) return Object.values(buildTokens.modes).flat();
    return buildTokens;
}

function getRule(ctx: ParserContext, name: string): Rule {
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

function buildRuleContent(ctx: RuleContext, rule: ParserRule): Method {
    const method = buildElement(ctx, rule.alternatives);
    const arrays: string[] = [];
    streamAllContents(rule.alternatives).forEach(item => {
        if (isAssignment(item) && isArrayOperator(item.operator)) {
            arrays.push(item.feature);
        }
    });
    return (args) => {
        ctx.parser.initializeElement(arrays);
        method(args);
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
        const predicate = ruleCall.arguments.length > 0 ? buildRuleCallPredicate(rule, ruleCall.arguments) : () => ({});
        if (hasContainerOfType(ruleCall, isAssignment) || isDataTypeRule(rule)) {
            return (args) => ctx.parser.subrule(idx, getRule(ctx, rule.name), ruleCall, predicate(args));
        } else {
            return (args) => ctx.parser.unassignedSubrule(idx, getRule(ctx, rule.name), ruleCall, predicate(args));
        }
    } else if (isTerminalRule(rule)) {
        const idx = ctx.consume++;
        const method = getToken(ctx, rule.name);
        return () => ctx.parser.consume(idx, method, ruleCall);
    } else {
        throw new Error();
    }
}

function buildRuleCallPredicate(rule: ParserRule, namedArgs: NamedArgument[]): (args: Args) => Args {
    const predicates = namedArgs.map(e => buildPredicate(e.value));
    return (args) => {
        const ruleArgs: Args = {};
        for (let i = 0; i < predicates.length; i++) {
            const ruleTarget = rule.parameters[i];
            const predicate = predicates[i];
            ruleArgs[ruleTarget.name] = predicate(args);
        }
        return ruleArgs;
    };
}

interface PredicatedMethod {
    ALT: Method,
    GATE?: Predicate
}

function buildPredicate(condition: Condition): Predicate {
    if (isDisjunction(condition)) {
        const left = buildPredicate(condition.left);
        const right = buildPredicate(condition.right);
        return (args) => (left(args) || right(args));
    } else if (isConjunction(condition)) {
        const left = buildPredicate(condition.left);
        const right = buildPredicate(condition.right);
        return (args) => (left(args) && right(args));
    } else if (isNegation(condition)) {
        const value = buildPredicate(condition.value);
        return (args) => !value(args);
    } else if (isParameterReference(condition)) {
        const name = condition.parameter.ref!.name;
        return (args) => args[name] === true;
    } else if (isLiteralCondition(condition)) {
        const value = !!condition.true;
        return () => value;
    }
    throw new Error();
}

function buildAlternatives(ctx: RuleContext, alternatives: Alternatives): Method {
    if (alternatives.elements.length === 1) {
        return buildElement(ctx, alternatives.elements[0]);
    } else {
        const methods: PredicatedMethod[] = [];

        for (const element of alternatives.elements) {
            const predicatedMethod: PredicatedMethod = {
                ALT: buildElement(ctx, element)
            };
            if (isGroup(element) && element.guardCondition) {
                predicatedMethod.GATE = buildPredicate(element.guardCondition);
            }
            methods.push(predicatedMethod);
        }

        const idx = ctx.or++;
        return (args) => ctx.parser.alternatives(idx, methods.map(method => {
            const alt: IOrAlt<unknown> = {
                ALT: () => method.ALT(args)
            };
            const gate = method.GATE;
            if (gate) {
                alt.GATE = () => gate(args);
            }
            return alt;
        }));
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

    return (args) => methods.forEach(e => e(args));
}

function buildAction(ctx: RuleContext, action: Action): Method {
    return () => ctx.parser.action(action.type, action);
}

function buildCrossReference(ctx: RuleContext, crossRef: CrossReference, terminal = crossRef.terminal): Method {
    if (!terminal) {
        if (!crossRef.type.ref) {
            throw new Error('Could not resolve reference to rule: ' + crossRef.type.$refText);
        }
        const assignment = findNameAssignment(crossRef.type.ref);
        const assignTerminal = assignment?.terminal;
        if (!assignTerminal) {
            throw new Error('Could not find name assignment for rule: ' + crossRef.type.ref.name);
        }
        return buildCrossReference(ctx, crossRef, assignTerminal);
    } else if (isRuleCall(terminal) && isParserRule(terminal.rule.ref)) {
        const idx = ctx.subrule++;
        const name = terminal.rule.ref.name;
        return (args) => ctx.parser.subrule(idx, getRule(ctx, name), crossRef, args);
    } else if (isRuleCall(terminal) && isTerminalRule(terminal.rule.ref)) {
        const idx = ctx.consume++;
        const terminalRule = getToken(ctx, terminal.rule.ref.name);
        return () => ctx.parser.consume(idx, terminalRule, crossRef);
    } else if (isKeyword(terminal)) {
        const idx = ctx.consume++;
        const keyword = getToken(ctx, terminal.value);
        keyword.name = withKeywordSuffix(keyword.name);
        return () => ctx.parser.consume(idx, keyword, crossRef);
    }
    else {
        throw new Error('Could not build cross reference parser');
    }
}

const withKeywordSuffix = (name: string): string => name.endsWith(':KW') ? name : name + ':KW';

function buildKeyword(ctx: RuleContext, keyword: Keyword): Method {
    const idx = ctx.consume++;
    const token = ctx.tokens.get(keyword.value);
    if (!token) {
        throw new Error('Could not find token for keyword: ' + keyword.value);
    }
    token.name = withKeywordSuffix(token.name);
    return () => ctx.parser.consume(idx, token, keyword);
}

function wrap(ctx: RuleContext, method: Method, cardinality: Cardinality): Method {
    if (!cardinality) {
        return method;
    } else if (cardinality === '*') {
        const idx = ctx.many++;
        return (args) => ctx.parser.many(idx, () => method(args));
    } else if (cardinality === '+') {
        const idx = ctx.many++;
        return (args) => ctx.parser.atLeastOne(idx, () => method(args));
    } else if (cardinality === '?') {
        const idx = ctx.optional++;
        return (args) => ctx.parser.optional(idx, () => method(args));
    } else {
        throw new Error();
    }
}
