/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AbstractRule, Grammar, isAction, isAssignment, isParserRule, isPrimitiveRule, isRuleCall, isTerminalRule, Keyword, LangiumGrammarAstType, ParserRule, PrimitiveRule, TerminalRule, UnorderedGroup } from './generated/ast';
import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from '../service/validation/validation-registry';
import { LangiumGrammarServices } from './langium-grammar-module';
import { isDataTypeRule } from './grammar-util';
import { AstNodeContent, streamAllContents } from '../utils/ast-util';

type LangiumGrammarChecks = { [type in LangiumGrammarAstType]?: ValidationCheck | ValidationCheck[] }

export class LangiumGrammarValidationRegistry extends ValidationRegistry {
    constructor(services: LangiumGrammarServices) {
        super(services);
        const validator = services.validation.LangiumGrammarValidator;
        const checks: LangiumGrammarChecks = {
            AbstractRule: validator.checkRuleName,
            PrimitiveRule: [
                validator.checkPrimitiveRuleCalls,
                validator.checkRuleReturnType
            ],
            ParserRule: [
                validator.checkParserRuleDataType,
                validator.checkParserRuleReturnType
            ],
            TerminalRule: validator.checkRuleReturnType,
            Keyword: validator.checkKeyword,
            UnorderedGroup: validator.checkUnorderedGroup,
            Grammar: [
                validator.checkGrammarName,
                validator.checkFirstGrammarRule,
                validator.checkUniqueRuleName,
                validator.checkGrammarHiddenTokens
            ]
        };
        this.register(checks, validator);
    }
}

export class LangiumGrammarValidator {

    checkGrammarName(grammar: Grammar, accept: ValidationAcceptor): void {
        if (grammar.name) {
            const firstChar = grammar.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Grammar name should start with an upper case letter.', { node: grammar, property: 'name' });
            }
        }
    }

    checkFirstGrammarRule(grammar: Grammar, accept: ValidationAcceptor): void {
        const firstRule = grammar.rules.find(e => isParserRule(e)) as ParserRule;
        if (firstRule) {
            if (isDataTypeRule(firstRule)) {
                accept('error', 'The entry rule cannot be a data type rule.', { node: firstRule, property: 'name' });
            } else if (firstRule.fragment) {
                accept('error', 'The entry rule cannot be a fragment.', { node: firstRule, property: 'name' });
            }
        } else {
            accept('error', 'This grammar is missing an entry parser rule.', { node: grammar, property: 'name' });
        }
    }

    checkUniqueRuleName(grammar: Grammar, accept: ValidationAcceptor): void {
        const ruleMap = new Map<string, AbstractRule[]>();
        const message = "A rule's name has to be unique.";
        for (const rule of grammar.rules) {
            const lowerCaseName = rule.name.toLowerCase();
            const existing = ruleMap.get(lowerCaseName);
            if (existing) {
                existing.push(rule);
            } else {
                ruleMap.set(lowerCaseName, [rule]);
            }
        }
        for (const rules of ruleMap.values()) {
            if (rules.length > 1) {
                rules.forEach(e => {
                    accept('error', message, { node: e, property: 'name' });
                });
            }
        }
    }

    checkGrammarHiddenTokens(grammar: Grammar, accept: ValidationAcceptor): void {
        if (grammar.hiddenTokens && grammar.hiddenTokens.length > 0) {
            for (let i = 0; i < grammar.hiddenTokens.length; i++) {
                const hiddenToken = grammar.hiddenTokens[i];
                if (!hiddenToken.ref) {
                    continue;
                }
                if (isTerminalRule(hiddenToken.ref)) {
                    if (hiddenToken.ref.fragment) {
                        accept('error', 'Cannot use terminal fragments as hidden tokens.', { node: grammar, property: 'hiddenTokens', index: i });
                    }
                } else if (hiddenToken.ref) {
                    accept('error', 'Only terminal rules may be used as hidden tokens.', { node: grammar, property: 'hiddenTokens', index: i });
                }
            }
        }
    }

    checkRuleName(rule: AbstractRule, accept: ValidationAcceptor): void {
        if (rule.name) {
            const firstChar = rule.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Rule name should start with an upper case letter.', { node: rule, property: 'name' });
            }
        }
    }

    checkKeyword(keyword: Keyword, accept: ValidationAcceptor): void {
        if (keyword.value.length === 0) {
            accept('error', 'Keywords cannot be empty.', { node: keyword });
        } else if (keyword.value.trim().length === 0) {
            accept('error', 'Keywords cannot only consist of whitespace characters.', { node: keyword });
        } else if (/\s/g.test(keyword.value)) {
            accept('warning', 'Keywords should not contain whitespace characters.', { node: keyword });
        }
    }

    checkUnorderedGroup(unorderedGroup: UnorderedGroup, accept: ValidationAcceptor): void {
        accept('error', 'Unordered groups are currently not supported', { node: unorderedGroup });
    }

    checkPrimitiveRuleCalls(rule: PrimitiveRule, accept: ValidationAcceptor): void {
        const iterator = streamAllContents(rule).iterator();
        let result: IteratorResult<AstNodeContent>;
        do {
            result = iterator.next();
            if (!result.done) {
                const node = result.value.node;
                if (isRuleCall(node) && isParserRule(node.rule.ref)) {
                    accept('error', 'Primitive rules can only call other primitive rules or terminal rules', { node });
                }
                if (isAction(node)) {
                    accept('error', 'Primitive rules cannot contain actions.', { node });
                }
                if (isAssignment(node)) {
                    accept('error', 'Primitive rules cannot contain assignments.', { node });
                    iterator.prune();
                }
            }
        } while (!result.done);
    }

    checkParserRuleDataType(rule: ParserRule, accept: ValidationAcceptor): void {
        let shouldBePrimitiveRule = true;
        const iterator = streamAllContents(rule).iterator();
        let result: IteratorResult<AstNodeContent>;
        do {
            result = iterator.next();
            if (!result.done) {
                const node = result.value.node;
                if (isRuleCall(node) && isParserRule(node.rule.ref) || isAction(node) || isAssignment(node)) {
                    shouldBePrimitiveRule = false;
                }
            }
        } while (!result.done && shouldBePrimitiveRule);

        if (shouldBePrimitiveRule) {
            accept('error', 'This parser rule does not create an object. Use a primitive rule or add an action to the start of the rule to force object instantiation.', { node: rule, property: 'name' });
        }
    }

    checkParserRuleReturnType(rule: ParserRule, accept: ValidationAcceptor): void {
        if (rule.type && isPrimitiveType(rule.type)) {
            accept('error', 'Parser rules are not allowed to return a primitive value. Use a primitive rule for that.', { node: rule, property: 'type' });
        }
    }

    checkRuleReturnType(rule: PrimitiveRule | TerminalRule, accept: ValidationAcceptor): void {
        if (rule.type && !isPrimitiveType(rule.type)) {
            const type = isPrimitiveRule(rule) ? 'Primitive' : 'Terminal';
            accept('error', type + " rules can only return primitive types like 'string' or 'number'.", { node: rule, property: 'type' });
        }
    }
}

function isPrimitiveType(type: string): boolean {
    return ['string', 'number'].includes(type);
}