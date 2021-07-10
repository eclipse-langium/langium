/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TokenType } from 'chevrotain';
import { AbstractElement, Action, Alternatives, CrossReference, Grammar, Group, isAction, isAlternatives, isAssignment, isCrossReference, isGroup, isKeyword, isParserRule, isRuleCall, isTerminalRule, isUnorderedGroup, Keyword, ParserRule, RuleCall, UnorderedGroup } from '../grammar/generated/ast';
import { Cardinality, getTypeName, isArrayOperator, isDataTypeRule } from '../grammar/grammar-util';
import { LangiumServices } from '../services';
import { getContainerOfType, streamAllContents } from '../utils/ast-util';
import { stream } from '../utils/stream';
import { DatatypeSymbol, LangiumBaseParser } from './langium-base-parser';

type RuleContext = {
    option: number,
    consume: number,
    subrule: number,
    many: number,
    or: number
}

type Method = () => void;

export class LangiumParser extends LangiumBaseParser {

    private rules: Map<string, Method> = new Map();
    private tokens: Map<string, TokenType> = new Map();

    constructor(services: LangiumServices, tokens = services.parser.TokenBuilder.buildTokens(services.Grammar)) {
        super(services, tokens);
        tokens.forEach(e => {
            this.tokens.set(e.name, e);
        });
        this.buildInternalParser(services.Grammar);
    }

    protected getRule(name: string): Method {
        const rule = this.rules.get(name);
        if (!rule) throw new Error();
        return rule;
    }

    protected getToken(name: string): TokenType {
        const token = this.tokens.get(name);
        if (!token) throw new Error();
        return token;
    }

    protected buildInternalParser(grammar: Grammar): void {
        let first = true;
        for (const rule of stream(grammar.rules).filterType(isParserRule)) {
            const ctx: RuleContext = {
                consume: 1,
                option: 1,
                subrule: 1,
                many: 1,
                or: 1
            };
            this.buildRule(ctx, rule, first);
            first = false;
        }
    }

    protected buildRule(ctx: RuleContext, rule: ParserRule, first: boolean): void {
        const method = (first ? this.MAIN_RULE : this.DEFINE_RULE).bind(this);
        let type: string | symbol | undefined;
        if (!rule.fragment) {
            if (isDataTypeRule(rule)) {
                type = DatatypeSymbol;
            } else {
                type = getTypeName(rule);
            }
        }

        this.rules.set(rule.name, method(rule.name, type, this.buildRuleContent(ctx, rule)));
    }

    protected buildRuleContent(ctx: RuleContext, rule: ParserRule): () => unknown {
        const method = this.buildElement(ctx, rule.alternatives);
        const arrays: string[] = [];
        streamAllContents(rule.alternatives).forEach(e => {
            const item = e.node;
            if (isAssignment(item) && isArrayOperator(item.operator)) {
                arrays.push(item.feature);
            }
        });
        return () => {
            this.initializeElement(arrays);
            method();
            return this.construct();
        };
    }

    protected buildElement(ctx: RuleContext, element: AbstractElement): Method {
        let method: Method;
        if (isKeyword(element)) {
            method = this.buildKeyword(ctx, element);
        } else if (isAction(element)) {
            method = this.buildAction(element);
        } else if (isAssignment(element)) {
            method = this.buildElement(ctx, element.terminal);
        } else if (isCrossReference(element)) {
            method = this.buildCrossReference(ctx, element);
        } else if (isRuleCall(element)) {
            method = this.buildRuleCall(ctx, element);
        } else if (isAlternatives(element)) {
            method = this.buildAlternatives(ctx, element);
        } else if (isUnorderedGroup(element)) {
            method = this.buildUnorderedGroup(ctx, element);
        } else if (isGroup(element)) {
            method = this.buildGroup(ctx, element);
        } else {
            throw new Error();
        }
        return this.wrap(ctx, method, element.cardinality);
    }

    protected buildRuleCall(ctx: RuleContext, ruleCall: RuleCall): Method {
        const rule = ruleCall.rule.ref;
        if (isParserRule(rule)) {
            const idx = ctx.subrule++;
            if (getContainerOfType(ruleCall, isAssignment)) {
                return () => this.subrule(idx, this.getRule(rule.name), ruleCall);
            } else {
                return () => this.unassignedSubrule(idx, this.getRule(rule.name), ruleCall);
            }
        } else if (isTerminalRule(rule)) {
            const idx = ctx.consume++;
            const method = this.getToken(rule.name);
            return () => this.consume(idx, method, ruleCall);
        } else {
            throw new Error();
        }
    }

    protected buildAlternatives(ctx: RuleContext, alternatives: Alternatives): Method {
        if (alternatives.elements.length === 1) {
            return this.buildElement(ctx, alternatives.elements[0]);
        } else {
            const methods: Method[] = [];

            for (const element of alternatives.elements) {
                methods.push(this.buildElement(ctx, element));
            }

            const idx = ctx.or++;
            return () => this.or(idx, methods);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected buildUnorderedGroup(ctx: RuleContext, group: UnorderedGroup): Method {
        throw new Error('Unordered groups are not supported (yet)');
    }

    protected buildGroup(ctx: RuleContext, group: Group): Method {
        const methods: Method[] = [];

        for (const element of group.elements) {
            methods.push(this.buildElement(ctx, element));
        }

        return () => methods.forEach(e => e());
    }

    protected buildAction(action: Action): Method {
        return () => this.action(action.type, action);
    }

    protected buildCrossReference(ctx: RuleContext, crossRef: CrossReference): Method {
        const terminal = crossRef.terminal;
        if (!terminal) {
            const idx = ctx.consume++;
            const idToken = this.getToken('ID');
            return () => this.consume(idx, idToken, crossRef);
        } else if (isRuleCall(terminal) && isParserRule(terminal.rule.ref)) {
            const idx = ctx.subrule++;
            const name = terminal.rule.ref.name;
            return () => this.subrule(idx, this.getRule(name), crossRef);
        } else if (isRuleCall(terminal) && isTerminalRule(terminal.rule.ref)) {
            const idx = ctx.consume++;
            const terminalRule = this.getToken(terminal.rule.ref.name);
            return () => this.consume(idx, terminalRule, crossRef);
        } else {
            throw new Error();
        }
    }

    protected buildKeyword(ctx: RuleContext, keyword: Keyword): Method {
        const idx = ctx.consume++;
        const token = this.tokens.get(keyword.value);
        if (!token) {
            throw new Error();
        }
        return () => this.consume(idx, token, keyword);
    }

    protected wrap(ctx: RuleContext, method: Method, cardinality: Cardinality): Method {
        if (!cardinality) {
            return method;
        } else if (cardinality === '*') {
            const idx = ctx.many++;
            return () => this.many(idx, method);
        } else if (cardinality === '+') {
            const idx = ctx.many++;
            return () => this.atLeastOne(idx, method);
        } else if (cardinality === '?') {
            const idx = ctx.option++;
            return () => this.option(idx, method);
        } else {
            throw new Error();
        }
    }
}
