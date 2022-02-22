/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import path from 'path';
import { DiagnosticTag } from 'vscode-languageserver-types';
import { Utils } from 'vscode-uri';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { getContainerOfType, getDocument, streamAllContents } from '../utils/ast-util';
import { MultiMap } from '../utils/collections';
import { stream } from '../utils/stream';
import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from '../validation/validation-registry';
import { LangiumDocument, LangiumDocuments } from '../workspace/documents';
import * as ast from './generated/ast';
import { findNameAssignment, getEntryRule, isDataTypeRule, resolveImport, resolveTransitiveImports, terminalRegex } from './grammar-util';
import type { LangiumGrammarServices } from './langium-grammar-module';

type LangiumGrammarChecks = { [type in ast.LangiumGrammarAstType]?: ValidationCheck | ValidationCheck[] }

export class LangiumGrammarValidationRegistry extends ValidationRegistry {
    constructor(services: LangiumGrammarServices) {
        super(services);
        const validator = services.validation.LangiumGrammarValidator;
        const checks: LangiumGrammarChecks = {
            AbstractRule: validator.checkRuleName,
            ParserRule: [
                validator.checkParserRuleDataType,
                validator.checkRuleParametersUsed
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
                validator.checkUniqueImportedRules,
                validator.checkDuplicateImportedGrammar,
                validator.checkGrammarHiddenTokens,
                validator.checkGrammarForUnusedRules,
                validator.checkGrammarImports
            ],
            GrammarImport: validator.checkPackageImport,
            CharacterRange: validator.checkInvalidCharacterRange,
            RuleCall: [
                validator.checkUsedHiddenTerminalRule,
                validator.checkUsedFragmentTerminalRule,
                validator.checkRuleCallParameters,
            ],
            TerminalRuleCall: validator.checkUsedHiddenTerminalRule,
            CrossReference: [
                validator.checkCrossReferenceSyntax,
                validator.checkCrossRefNameAssignment,
                validator.checkCrossRefTerminalType
            ]
        };
        this.register(checks, validator);
    }
}

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
        if (grammar.isDeclared && entryRules.length === 0) {
            const possibleEntryRule = grammar.rules.find(e => ast.isParserRule(e) && !isDataTypeRule(e));
            if (possibleEntryRule) {
                accept('error', 'The grammar is missing an entry parser rule. This rule can be an entry one.', { node: possibleEntryRule, property: 'name', code: IssueCodes.EntryRuleTokenSyntax });
            } else {
                accept('error', 'This grammar is missing an entry parser rule.', { node: grammar, property: 'name' });
            }
        } else if(!grammar.isDeclared && entryRules.length >= 1) {
            entryRules.forEach(rule => accept('error', 'Cannot declare entry rules for unnamed grammars.', { node: rule, property: 'name' }));
        } else if (entryRules.length > 1) {
            entryRules.forEach(rule => accept('error', 'The entry rule has to be unique.', { node: rule, property: 'name' }));
        } else if (isDataTypeRule(entryRules[0])) {
            accept('error', 'The entry rule cannot be a data type rule.', { node: entryRules[0], property: 'name' });
        }
    }

    /**
     * Check whether any rule defined in this grammar is a duplicate of an already defined rule or an imported rule
     */
    checkUniqueRuleName(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        const ruleMap = new MultiMap<string, ast.AbstractRule>();
        for (const rule of grammar.rules) {
            ruleMap.add(rule.name, rule);
        }
        for (const name of ruleMap.keys()) {
            const rules = ruleMap.get(name);
            if (rules.length > 1) {
                rules.forEach(e => {
                    accept('error', "A rule's name has to be unique.", { node: e, property: 'name' });
                });
            }
        }
        const importedRules = new Set<string>();
        const resolvedGrammars = resolveTransitiveImports(this.documents, grammar);
        for (const resolvedGrammar of resolvedGrammars) {
            for (const rule of resolvedGrammar.rules) {
                importedRules.add(rule.name);
            }
        }
        for (const name of ruleMap.keys()) {
            if (importedRules.has(name)) {
                const rules = ruleMap.get(name);
                rules.forEach(e => {
                    accept('error', `A rule with the name '${e.name}' already exists in an imported grammar.`, { node: e, property: 'name' });
                });
            }
        }
    }

    checkDuplicateImportedGrammar(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        const importMap = new MultiMap<ast.Grammar, ast.GrammarImport>();
        for (const imp of grammar.imports) {
            const resolvedGrammar = resolveImport(this.documents, imp);
            if (resolvedGrammar) {
                importMap.add(resolvedGrammar, imp);
            }
        }
        for (const grammar of importMap.keys()) {
            const imports = importMap.get(grammar);
            if (imports.length > 1) {
                imports.forEach((imp, i) => {
                    if (i > 0) {
                        accept('warning', 'The grammar is already being directly imported.', { node: imp, tags: [DiagnosticTag.Unnecessary] });
                    }
                });
            }
        }
    }

    /**
     * Compared to the validation above, this validation only checks whether two imported grammars export the same grammar rule.
     */
    checkUniqueImportedRules(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        const imports = new Map<ast.GrammarImport, ast.Grammar[]>();
        for (const imp of grammar.imports) {
            const importedGrammars = resolveTransitiveImports(this.documents, imp);
            imports.set(imp, importedGrammars);
        }
        const allDuplicates = new MultiMap<ast.GrammarImport, string>();
        for (const outerImport of grammar.imports) {
            const outerGrammars = imports.get(outerImport)!;
            for (const innerImport of grammar.imports) {
                if (outerImport === innerImport) {
                    continue;
                }
                const innerGrammars = imports.get(innerImport)!;
                const duplicates = this.getDuplicateExportedRules(outerGrammars, innerGrammars);
                for (const duplicate of duplicates) {
                    allDuplicates.add(outerImport, duplicate);
                }
            }
        }
        for (const imp of grammar.imports) {
            const duplicates = allDuplicates.get(imp);
            if (duplicates.length > 0) {
                accept('error', 'Some rules exported by this grammar are also included in other imports: ' + stream(duplicates).distinct().join(', '), { node: imp, property: 'path' });
            }
        }
    }

    private getDuplicateExportedRules(outer: ast.Grammar[], inner: ast.Grammar[]): Set<string> {
        const exclusiveOuter = outer.filter(g => !inner.includes(g));
        const outerRules = exclusiveOuter.flatMap(e => e.rules);
        const innerRules = inner.flatMap(e => e.rules);
        const duplicates = new Set<string>();
        for (const outerRule of outerRules) {
            const outerName = outerRule.name;
            for (const innerRule of innerRules) {
                const innerName = innerRule.name;
                if (outerName === innerName) {
                    duplicates.add(innerRule.name);
                }
            }
        }
        return duplicates;
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
            if ('hidden' in parentRule && parentRule.hidden) {
                return;
            }
            const ref = ruleCall.rule.ref;
            if (ast.isTerminalRule(ref) && ref.hidden) {
                accept('error', 'Cannot use hidden terminal in non-hidden rule', { node: ruleCall, property: 'rule' });
            }
        }
    }

    checkUsedFragmentTerminalRule(ruleCall: ast.RuleCall, accept: ValidationAcceptor): void {
        const terminal = ruleCall.rule.ref;
        if (ast.isTerminalRule(terminal) && terminal.fragment) {
            const parentRule = getContainerOfType(ruleCall, ast.isParserRule);
            if (parentRule) {
                accept('error', 'Cannot use terminal fragments as part of parser rules.', { node: ruleCall, property: 'rule' });
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
        streamAllContents(grammar).forEach(e => {
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
                accept('error', `Referenced rule "${ruleCall.rule.ref?.name}" is not imported.`, {
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
        streamAllContents(rule).forEach(node => {
            if (ast.isRuleCall(node)) {
                const refRule = node.rule.ref;
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

    checkRuleParametersUsed(rule: ast.ParserRule, accept: ValidationAcceptor): void {
        const parameters = rule.parameters;
        if (parameters.length > 0) {
            const allReferences = streamAllContents(rule).filter(ast.isParameterReference);
            for (const parameter of parameters) {
                if (!allReferences.some(e => e.parameter.ref === parameter)) {
                    accept('hint', `Parameter '${parameter.name}' is unused.`, {
                        node: parameter,
                        tags: [DiagnosticTag.Unnecessary]
                    });
                }
            }
        }
    }

    checkParserRuleDataType(rule: ast.ParserRule, accept: ValidationAcceptor): void {
        const hasDatatypeReturnType = rule.type?.name && isPrimitiveType(rule.type.name);
        const isDataType = isDataTypeRule(rule);
        if (!hasDatatypeReturnType && isDataType) {
            accept('error', 'This parser rule does not create an object. Add a primitive return type or an action to the start of the rule to force object instantiation.', { node: rule, property: 'name' });
        } else if (hasDatatypeReturnType && !isDataType) {
            accept('error', 'Normal parser rules are not allowed to return a primitive value. Use a datatype rule for that.', { node: rule, property: 'type' });
        }
    }

    checkTerminalRuleReturnType(rule: ast.TerminalRule, accept: ValidationAcceptor): void {
        if (rule.type?.name && !isPrimitiveType(rule.type.name)) {
            accept('error', "Terminal rules can only return primitive types like 'string', 'boolean', 'number' or 'date'.", { node: rule, property: 'type' });
        }
    }

    checkRuleCallParameters(ruleCall: ast.RuleCall, accept: ValidationAcceptor): void {
        const rule = ruleCall.rule.ref;
        if (ast.isParserRule(rule)) {
            const expected = rule.parameters.length;
            const given = ruleCall.arguments.length;
            if (expected !== given) {
                accept('error', `Rule '${rule.name}' expects ${expected} arguments, but got ${given}.`, { node: ruleCall });
            }
        } else if (ast.isTerminalRule(rule) && ruleCall.arguments.length > 0) {
            accept('error', 'Terminal rules do not accept any arguments', { node: ruleCall });
        }
    }

    checkCrossRefNameAssignment(reference: ast.CrossReference, accept: ValidationAcceptor): void {
        if (!reference.terminal && reference.type.ref && !findNameAssignment(reference.type.ref)) {
            accept('error', 'Cannot infer terminal or data type rule for cross reference.', { node: reference, property: 'type' });
        }
    }

    checkCrossRefTerminalType(reference: ast.CrossReference, accept: ValidationAcceptor): void {
        if (ast.isRuleCall(reference.terminal) && ast.isParserRule(reference.terminal.rule.ref) && !isDataTypeRule(reference.terminal.rule.ref)) {
            accept('error', 'Parser rules cannot be used for cross references.', { node: reference.terminal, property: 'rule' });
        }
    }
}

const primitiveTypes = ['string', 'number', 'boolean', 'Date'];

function isPrimitiveType(type: string): boolean {
    return primitiveTypes.includes(type);
}
