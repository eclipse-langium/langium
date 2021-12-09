/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import path from 'path';
import { DiagnosticTag } from 'vscode-languageserver-types';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { getContainerOfType, getDocument, streamAllContents } from '../utils/ast-util';
import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from '../validation/validation-registry';
import { getEntryRule, isDataTypeRule, resolveImport, resolveTransitiveImports, terminalRegex } from './grammar-util';
import { LangiumGrammarServices } from './langium-grammar-module';
import * as ast from './generated/ast';
import { LangiumDocument, LangiumDocuments } from '../documents/document';
import { Utils } from 'vscode-uri';

type LangiumGrammarChecks = { [type in ast.LangiumGrammarAstType]?: ValidationCheck | ValidationCheck[] }

export class LangiumGrammarValidationRegistry extends ValidationRegistry {
    constructor(services: LangiumGrammarServices) {
        super(services);
        const validator = services.validation.LangiumGrammarValidator;
        const checks: LangiumGrammarChecks = {
            AbstractRule: validator.checkRuleName,
            ParserRule: [
                validator.checkParserRuleDataType
            ],
            TerminalRule: [
                validator.checkTerminalRuleReturnType,
                validator.checkHiddenTerminalRule,
                validator.checkEmptyTerminalRule
            ],
            Keyword: validator.checkKeyword,
            UnorderedGroup: validator.checkUnorderedGroup,
            Grammar: [
                validator.checkGrammarName,
                validator.checkEntryGrammarRule,
                validator.checkUniqueRuleName,
                validator.checkGrammarHiddenTokens,
                validator.checkGrammarForUnusedRules,
                validator.checkGrammarImports
            ],
            GrammarImport: validator.checkPackageImport,
            CharacterRange: validator.checkInvalidCharacterRange,
            RuleCall: validator.checkUsedHiddenTerminalRule,
            TerminalRuleCall: validator.checkUsedHiddenTerminalRule,
            CrossReference: validator.checkCrossReferenceSyntax
        };
        this.register(checks, validator);
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace IssueCodes {
    export const GrammarNameUppercase = 'grammar-name-uppercase';
    export const RuleNameUppercase = 'rule-name-uppercase';
    export const HiddenGrammarTokens = 'hidden-grammar-tokens';
    export const UseRegexTokens = 'use-regex-tokens';
    export const EntryRuleTokenSyntax = 'entry-rule-token-syntax';
    export const CrossRefTokenSyntax = 'cross-ref-token-syntax';
    export const MissingImport = 'missing-import';
    export const UnnecessaryFileExtension = 'unnecessary-file-extension';
}

export class LangiumGrammarValidator {

    protected readonly references: References;
    protected readonly documents: LangiumDocuments

    constructor(services: LangiumServices) {
        this.references = services.references.References;
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    checkGrammarName(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        if (grammar.name) {
            const firstChar = grammar.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Grammar name should start with an upper case letter.', { node: grammar, property: 'name', code: IssueCodes.GrammarNameUppercase });
            }
        }
    }

    checkEntryGrammarRule(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        const entryRules = grammar.rules.filter(e => ast.isParserRule(e) && e.entry) as ast.ParserRule[];
        if (entryRules.length === 0) {
            const possibleEntryRule = grammar.rules.find(e => ast.isParserRule(e) && !isDataTypeRule(e));
            if (possibleEntryRule) {
                accept('error', 'The grammar is missing an entry parser rule. This rule can be an entry one.', { node: possibleEntryRule, property: 'name', code: IssueCodes.EntryRuleTokenSyntax });
            } else {
                accept('error', 'This grammar is missing an entry parser rule.', { node: grammar, property: 'name' });
            }
        } else if (entryRules.length > 1) {
            entryRules.forEach(rule => accept('error', 'The entry rule has to be unique.', { node: rule, property: 'name' }));
        } else if (isDataTypeRule(entryRules[0])) {
            accept('error', 'The entry rule cannot be a data type rule.', { node: entryRules[0], property: 'name' });
        }
    }

    checkUniqueRuleName(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        const ruleMap = new Map<string, ast.AbstractRule[]>();
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

    checkGrammarHiddenTokens(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        if (grammar.definesHiddenTokens) {
            accept('error', 'Hidden terminals are declared at the terminal definition.', { node: grammar, property: 'definesHiddenTokens', code: IssueCodes.HiddenGrammarTokens});
        }
    }

    checkHiddenTerminalRule(terminalRule: ast.TerminalRule, accept: ValidationAcceptor): void {
        if (terminalRule.hidden && terminalRule.fragment) {
            accept('error', 'Cannot use terminal fragments as hidden tokens.', { node: terminalRule, property: 'hidden' });
        }
    }

    checkEmptyTerminalRule(terminalRule: ast.TerminalRule, accept: ValidationAcceptor): void {
        try {
            const regex = terminalRegex(terminalRule);
            if (new RegExp(regex).test('')) {
                accept('error', 'This terminal could match an empty string.', { node: terminalRule, property: 'name' });
            }
        } catch {
            // In case the terminal can't be transformed into a regex, we throw an error
            // As this indicates unresolved cross references or parser errors, we can ignore this here
        }
    }

    checkUsedHiddenTerminalRule(ruleCall: ast.RuleCall | ast.TerminalRuleCall, accept: ValidationAcceptor): void {
        const parentRule = getContainerOfType(ruleCall, (n): n is ast.TerminalRule | ast.ParserRule => ast.isTerminalRule(n) || ast.isParserRule(n));
        if (parentRule) {
            if ('hidden' in parentRule && parentRule?.hidden) {
                return;
            }
            const ref = ruleCall.rule.ref;
            if (ast.isTerminalRule(ref) && ref.hidden) {
                accept('error', 'Cannot use hidden terminal in non-hidden rule', { node: ruleCall, property: 'rule' });
            }
        }
    }

    checkCrossReferenceSyntax(crossRef: ast.CrossReference, accept: ValidationAcceptor): void {
        if (crossRef.deprecatedSyntax) {
            accept('error', "'|' is deprecated. Please, use ':' instead.", { node: crossRef, property: 'deprecatedSyntax', code: IssueCodes.CrossRefTokenSyntax });
        }
    }

    checkPackageImport(imp: ast.GrammarImport, accept: ValidationAcceptor): void {
        const resolvedGrammar = resolveImport(this.documents, imp);
        if (resolvedGrammar === undefined) {
            accept('error', 'Import cannot be resolved.', { node: imp, property: 'path' });
        } else if (imp.path.endsWith('.langium')) {
            accept('warning', 'Imports do not need file extensions.', { node: imp, property: 'path', code: IssueCodes.UnnecessaryFileExtension });
        }
    }

    checkGrammarImports(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        // Compute transitive grammar dependencies once for each grammar
        const importedGrammars = new Set(resolveTransitiveImports(this.documents, grammar).map(e => getDocument(e)));
        streamAllContents(grammar).map(e => e.node).forEach(e => {
            if (ast.isRuleCall(e) || ast.isTerminalRuleCall(e)) {
                this.checkRuleCallImport(e, importedGrammars, accept);
            }
        });
    }

    private checkRuleCallImport(ruleCall: ast.RuleCall | ast.TerminalRuleCall, importedDocuments: Set<LangiumDocument>, accept: ValidationAcceptor): void {
        const ref = ruleCall.rule.ref;
        if (ref) {
            const refDoc = getDocument(ref);
            const document = getDocument(ruleCall);
            const grammar = document.parseResult.value;
            // Only check if the rule is sourced from another document
            if (ast.isGrammar(grammar) && refDoc !== document && !importedDocuments.has(refDoc)) {
                let relative = path.relative(Utils.dirname(document.uri).fsPath, refDoc.uri.fsPath);
                if (relative.endsWith('.langium')) {
                    relative = relative.substring(0, relative.length - '.langium'.length);
                }
                if (!relative.startsWith('.')) {
                    relative = './' + relative;
                }
                accept('error', `Referenced rule "${ruleCall.rule.$refText}" is not imported.`, {
                    node: ruleCall,
                    property: 'rule',
                    code: IssueCodes.MissingImport,
                    data: relative
                });
            }
        }
    }

    checkInvalidCharacterRange(range: ast.CharacterRange, accept: ValidationAcceptor): void {
        if (range.right) {
            const message = 'Character ranges cannot use more than one character';
            let invalid = false;
            if (range.left.value.length > 1) {
                invalid = true;
                accept('error', message, { node: range.left, property: 'value' });
            }
            if (range.right.value.length > 1) {
                invalid = true;
                accept('error', message, { node: range.right, property: 'value' });
            }
            if (!invalid) {
                accept('hint', 'Consider using regex instead of character ranges', { node: range, code: IssueCodes.UseRegexTokens });
            }
        }
    }

    checkGrammarForUnusedRules(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        const visitedSet = new Set<string>();
        const entry = getEntryRule(grammar);
        if (entry) {
            this.ruleDfs(entry, visitedSet);
            visitedSet.add(entry.name);
        }
        for (const rule of grammar.rules) {
            if (ast.isTerminalRule(rule) && rule.hidden) {
                continue;
            }
            if (!visitedSet.has(rule.name)) {
                accept('hint', 'This rule is declared but never referenced.', { node: rule, property: 'name', tags: [DiagnosticTag.Unnecessary] });
            }
        }
    }

    private ruleDfs(rule: ast.ParserRule, visitedSet: Set<string>): void {
        streamAllContents(rule).forEach(content => {
            if (ast.isRuleCall(content.node)) {
                const refRule = content.node.rule.ref;
                if (refRule && !visitedSet.has(refRule.name)) {
                    visitedSet.add(refRule.name);
                    if (ast.isParserRule(refRule)) {
                        this.ruleDfs(refRule, visitedSet);
                    }
                }
            }
        });
    }

    checkRuleName(rule: ast.AbstractRule, accept: ValidationAcceptor): void {
        if (rule.name) {
            const firstChar = rule.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Rule name should start with an upper case letter.', { node: rule, property: 'name', code: IssueCodes.RuleNameUppercase });
            }
        }
    }

    checkKeyword(keyword: ast.Keyword, accept: ValidationAcceptor): void {
        if (keyword.value.length === 0) {
            accept('error', 'Keywords cannot be empty.', { node: keyword });
        } else if (keyword.value.trim().length === 0) {
            accept('error', 'Keywords cannot only consist of whitespace characters.', { node: keyword });
        } else if (/\s/g.test(keyword.value)) {
            accept('warning', 'Keywords should not contain whitespace characters.', { node: keyword });
        }
    }

    checkUnorderedGroup(unorderedGroup: ast.UnorderedGroup, accept: ValidationAcceptor): void {
        accept('error', 'Unordered groups are currently not supported', { node: unorderedGroup });
    }

    checkParserRuleDataType(rule: ast.ParserRule, accept: ValidationAcceptor): void {
        const hasDatatypeReturnType = rule.type && isPrimitiveType(rule.type);
        const isDataType = isDataTypeRule(rule);
        if (!hasDatatypeReturnType && isDataType) {
            accept('error', 'This parser rule does not create an object. Add a primitive return type or an action to the start of the rule to force object instantiation.', { node: rule, property: 'name' });
        } else if (hasDatatypeReturnType && !isDataType) {
            accept('error', 'Normal parser rules are not allowed to return a primitive value. Use a datatype rule for that.', { node: rule, property: 'type' });
        }
    }

    checkTerminalRuleReturnType(rule: ast.TerminalRule, accept: ValidationAcceptor): void {
        if (rule.type && !isPrimitiveType(rule.type)) {
            accept('error', "Terminal rules can only return primitive types like 'string', 'boolean', 'number' or 'date'.", { node: rule, property: 'type' });
        }
    }
}

const primitiveTypes = ['string', 'number', 'boolean', 'Date'];

function isPrimitiveType(type: string): boolean {
    return primitiveTypes.includes(type);
}
