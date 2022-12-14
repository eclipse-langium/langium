/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import {
    getTerminalParts, isCommentTerminal, CompositeGeneratorNode, NL, toString, escapeRegExp, GrammarAST, isWhitespaceRegExp
} from 'langium';
import { terminalRegex } from 'langium/lib/grammar/internal-grammar-util';
import { LangiumLanguageConfig } from '../../package';
import { collectKeywords } from '../util';

/**
 * Monarch Language Definition, describes aspects & token categories of target language
 */
interface LanguageDefinition {
    readonly name: string;
    readonly keywords: string[];
    readonly operators: string[];
    readonly symbols: string[];
    readonly tokenPostfix: string;
}

/**
 * Monarch Tokenizer, consists of an object that defines states.
 */
interface Tokenizer {
    states: State[]
}

/**
 * Name of a State
 */
type StateName = string;

/**
 * Each state is defined as an array of rules which are used to match the input
 * Rules can be regular, or other States whose rules we should include in this state
 */
interface State {
    name: StateName
    rules: Array<Rule | State>
}

/**
 * A rule that matches input. Can have either an action, or an array of cases.
 */
interface Rule {
    regex: RegExp | string;
    action: Action | Case[];
}

/**
 * A case that selects a specific action by matching a guard pattern
 */
interface Case {
    guard: string;
    action: Action;
}

/**
 * Determines whether a given object is a Rule instance
 * @param obj Object to check
 * @returns Whether this object is a Rule
 */
function isRule(obj: State | Rule): obj is Rule {
    return (obj as Rule).regex !== undefined && (obj as Rule).action !== undefined;
}

/**
 * Name of a token type, such as 'string'
 */
type Token = string;

/**
 * Token class to be used for CSS rendering, such as 'keyword', 'component', or 'type.identifer'
 */
type TokenClass = string;

/**
 * Next state that proceeds from an action, can also be a pop or a push of the current state (like for nested block comments)
 */
type NextState = StateName | '@pop' | '@push';

/**
 * An action performed when a rule (or a case) matches token.
 * It can determine the token class, as well whether to push/pop a tokenizer state
 */
interface Action {
    token?: Token
    tokenClass?: TokenClass
    next?: NextState
    // other more advanced states omitted...
}

/**
 * Abstract representation of a Monarch grammar file
 */
interface MonarchGrammar {
    readonly languageDefinition: LanguageDefinition;
    readonly tokenizer: Tokenizer;
}

/**
 * Generates a Monarch highlighting grammar file's contents, based on the passed Langium grammar
 * @param grammar Langium grammar to use in generating this Monarch syntax highlighting file content
 * @param config Langium Config to also use during generation
 * @returns Generated Monarch syntax highlighting file content
 */
export function generateMonarch(grammar: langium.Grammar, config: LangiumLanguageConfig): string {

    const symbols = getSymbols(grammar);
    const regex = /[{}[\]()]/;
    const operators = symbols.filter(s => !regex.test(s));

    // build absract monarch grammar representation
    const monarchGrammar: MonarchGrammar = {
        languageDefinition: {
            name:       config.id,  // identifier for generating the grammar export
            keywords:   getKeywords(grammar),
            operators,
            symbols,
            tokenPostfix: '.' + config.id, // category appended to all tokens
        },
        tokenizer: {
            states: getTokenizerStates(grammar)
        }
    };

    // return concrete monarch grammar representation
    return prettyPrint(monarchGrammar);
}

/**
 * Gets Monarch tokenizer states from a Langium grammar
 * @param grammar Langium grammar to source tokenizer states from
 * @returns Array of tokenizer states
 */
function getTokenizerStates(grammar: langium.Grammar): State[] {

    // initial state, name is arbitrary, just needs to come first
    const initialState: State = {
        name: 'initial',
        rules: getTerminalRules(grammar)
    };

    const whitespaceState: State = {
        name: 'whitespace',
        rules: getWhitespaceRules(grammar)
    };

    const commentState: State = {
        name: 'comment',
        rules: getCommentRules(grammar)
    };

    // order the following additional rules, to prevent
    // comment sequences being classified as symbols

    // add include for the whitespace state
    initialState.rules.push(whitespaceState);

    // add operator & symbol case handling
    initialState.rules.push({
        regex: '@symbols',
        action: [
            {
                guard: '@operators',
                action: { token: 'operator' }
            },
            // by default, leave the symbol alone
            {
                guard: '@default',
                action: { token: '' }
            }
        ]
    });

    return [
        initialState,
        whitespaceState,
        commentState
    ];
}

/**
 * Pretty prints a monarch grammar into a concrete form, suitable for writing to a file
 * @param monarchGrammar Grammar to pretty print
 * @returns Monarch grammar in concrete form
 */
function prettyPrint(monarchGrammar: MonarchGrammar): string {
    const name = monarchGrammar.languageDefinition.name;
    const node = new CompositeGeneratorNode(
        `// Monarch syntax highlighting for the ${name} language.`, NL,
        'export default {', NL
    );

    node.indent(grammarDef => {
        // add language definitions
        prettyPrintLangDef(monarchGrammar.languageDefinition, grammarDef);
        grammarDef.append(NL, NL);

        // add tokenizer parts, simple state machine groupings
        prettyPrintTokenizer(monarchGrammar.tokenizer, grammarDef);
        grammarDef.append(NL);

    });
    node.append('};', NL);

    return toString(node);
}

/**
 * Generates an entry for a language definition, given a name (token category) and values
 * @param name Category of language definition to add
 * @param values Values to add under the given category
 * @returns GeneratorNode containing this printed language definition entry
 */
function genLanguageDefEntry(name: string, values: string[]): CompositeGeneratorNode {
    const node = new CompositeGeneratorNode(`${name}: [`, NL);
    node.indent(langDefValues => {
        langDefValues.append(values.map(v => `'${v}'`).join(','));
    });
    node.append(NL, '],');
    return node;
}

/**
 * Pretty prints the language definition portion of a Monarch grammar
 * @param languageDef LanguageDefinition to pretty print
 * @param node Existing generator node to append printed language definition to
 */
function prettyPrintLangDef(languageDef: LanguageDefinition, node: CompositeGeneratorNode): void {
    node.append(
        genLanguageDefEntry('keywords', languageDef.keywords), NL,
        genLanguageDefEntry('operators', languageDef.operators), NL,
        // special case, identify symbols via singular regex
        'symbols:  /' +  languageDef.symbols.map(escapeRegExp).join('|') + '/,'
    );
}

/**
 * Pretty prints the tokenizer portion of a Monarch grammar file
 * @param tokenizer Tokenizer portion to print out
 * @param node Existing generator node to append printed tokenizer to
 */
function prettyPrintTokenizer(tokenizer: Tokenizer, node: CompositeGeneratorNode): void {
    node.append('tokenizer: {', NL);
    node.indent(tokenizerStates => {
        for (const state of tokenizer.states) {
            prettyPrintState(state, tokenizerStates);
            tokenizerStates.append(NL);
        }
    });
    node.append('}');
}

/**
 * Pretty prints a tokenizer state, composed of various rules
 * @param state Tokenizer state to pretty print
 * @param node Existing enerator node to append printed state to
 */
function prettyPrintState(state: State, node: CompositeGeneratorNode): void {
    node.append(state.name + ': [', NL);
    node.indent(inode => {
        for(const rule of state.rules) {
            inode.append(prettyPrintRule(rule), NL);
        }
    });
    node.append('],');
}

/**
 * Pretty prints a Rule.
 * This can either be a literal rule to match w/ an action, or a reference to a state to include here
 * @param ruleOrState Rule to pretty print. If it's a state, we include that state's contents implicitly within this context.
 * @returns Generator node containing this printed rule
 */
function prettyPrintRule(ruleOrState: Rule | State): CompositeGeneratorNode {
    if (isRule(ruleOrState)) {
        // extract rule pattern, either just a string or a regex w/ parts
        const rulePatt = ruleOrState.regex instanceof RegExp ? getTerminalParts(ruleOrState.regex).join('') : `/${ruleOrState.regex}/`;
        return new CompositeGeneratorNode('{ regex: ' + rulePatt + ', action: ' + prettyPrintAction(ruleOrState.action) + ' },');
    } else {
        // include another state by name, implicitly includes all of its contents
        return new CompositeGeneratorNode(`{ include: '@${ruleOrState.name}' },`);
    }
}

/**
 * Pretty prints the action of a Rule
 * @param action Action to print. Can have several keywords to control what the state machine should do next.
 * @returns Action in concrete form
 */
function prettyPrintAction(action: Action | Case[]): string {
    if (!Array.isArray(action)) {
        // plain action
        return JSON.stringify(action);
    } else {
        // array of cases, each with an action
        const prettyCases: string = action.map(c => `'${c.guard}': ` + prettyPrintAction(c.action)).join(', ');
        return '{ cases: { ' + prettyCases + ' }}';
    }
}

/**
 * Extracts Monarch token name from a Langium terminal rule, using either name or type.
 * @param rule Rule to convert to a Monarch token name
 * @returns Returns the equivalent monarch token name, or the original rule name
 */
function getMonarchTokenName(rule: GrammarAST.TerminalRule): string {
    if (rule.name.toLowerCase() === 'string') {
        // string is clarified as a terminal by name, but not necessarily by type
        return 'string';
    } else if (rule.type) {
        // use rule type
        return rule.type.name;
    } else {
        // fallback to the original name
        return rule.name;
    }
}

/**
 * Gets whitespace rules from the langium grammar. Includes starting comment sequence.
 * @param grammar Langium grammar to extract whitespace rules from
 * @returns Array of Monarch whitespace rules
 */
function getWhitespaceRules(grammar: langium.Grammar): Rule[] {
    const rules: Rule[] = [];
    for (const rule of grammar.rules) {
        if (GrammarAST.isTerminalRule(rule) && GrammarAST.isRegexToken(rule.definition)) {
            const regex = new RegExp(terminalRegex(rule));

            if (!isCommentTerminal(rule) && !isWhitespaceRegExp(regex)) {
                // skip rules that are not comments or whitespace
                continue;
            }

            // token name is either comment or whitespace
            const tokenName = isCommentTerminal(rule) ? 'comment' : 'white';

            const part = getTerminalParts(terminalRegex(rule))[0];

            // check if this is a comment terminal w/ a start & end sequence (multi-line)
            if (part.start !== '' && part.end !== '' && isCommentTerminal(rule)) {
                // state-based comment rule, only add push to jump into it
                rules.push({
                    regex: part.start.replace('/', '\\/'),
                    action: { token: tokenName, next: '@' + tokenName }
                });

            } else {
                // single regex rule, generally for whitespace
                rules.push({
                    regex: rule.definition.regex,
                    action: {token: tokenName }
                });
            }
        }
    }
    return rules;
}

/**
 * Gets comment state rules from the Langium grammar.
 * Accounts for multi-line comments, but without nesting.
 * @param grammar Langium grammar to extract comment rules from
 * @returns Array of Monarch comment rules
 */
function getCommentRules(grammar: langium.Grammar): Rule[] {
    const rules: Rule[] = [];
    for(const rule of grammar.rules) {
        if (GrammarAST.isTerminalRule(rule) && isCommentTerminal(rule) && GrammarAST.isRegexToken(rule.definition)) {
            const tokenName = 'comment';
            const part = getTerminalParts(terminalRegex(rule))[0];
            if (part.start !== '' && part.end !== '') {
                // rules to manage comment start/end
                // rule order matters

                const start = part.start.replace('/', '\\/');
                const end   = part.end.replace('/', '\\/');

                // 1st, add anything that's not in the start sequence
                rules.push({
                    regex: `[^${start}]+`,
                    action: { token: tokenName }
                });

                // 2nd, end of sequence, pop this state, keeping others on the stack
                rules.push({
                    regex: end,
                    action: { token: tokenName, next: '@pop' }
                });

                // 3rd, otherwise, start sequence characters are OK in this state
                rules.push({
                    regex: `[${start}]`,
                    action: { token: tokenName }
                });

            }
        }
    }
    return rules;
}

/**
 * Retrieves non-comment terminal rules, creating associated actions for them
 * @param grammar Grammar to get non-comment terminals from
 * @returns Array of Rules to add to a Monarch tokenizer state
 */
function getTerminalRules(grammar: langium.Grammar): Rule[] {
    const rules: Rule[] = [];
    for (const rule of grammar.rules) {
        if (GrammarAST.isTerminalRule(rule) && !isCommentTerminal(rule) && GrammarAST.isRegexToken(rule.definition)) {
            const regex = new RegExp(terminalRegex(rule));

            if (isWhitespaceRegExp(regex)) {
                // disallow terminal rules that match whitespace
                continue;
            }

            const tokenName = getMonarchTokenName(rule);
            // default action...
            let action: Action | Case[] = { token: tokenName };

            if (getKeywords(grammar).some(keyword => regex.test(keyword))) {
                // this rule overlaps with at least one keyword
                // add case so keywords aren't tagged incorrectly as this token type
                action = [{
                    guard: '@keywords',
                    action: { token: 'keyword' }
                },{
                    guard: '@default',
                    action // include default action from above
                }];
            }

            rules.push({
                regex: rule.definition.regex,
                action
            });
        }
    }
    return rules;
}

/**
 * Keyword regex for matching keyword terminals, or for only collecting symbol terminals
 */
const KeywordRegex = /[A-Za-z]/;

/**
 * Retrieves keywords from the current grammar
 * @param grammar Grammar to get keywords from
 * @returns Array of keywords
 */
function getKeywords(grammar: langium.Grammar): string[] {
    return collectKeywords(grammar).filter(kw => KeywordRegex.test(kw));
}

/**
 * Retrieve symbols from langium grammar
 * @param grammar Grammar to get symbols from
 * @returns Array of symbols, effective inverse of getKeywords
 */
function getSymbols(grammar: langium.Grammar): string[] {
    return collectKeywords(grammar).filter(kw => !KeywordRegex.test(kw));
}
