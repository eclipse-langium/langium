/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { getTerminalParts, isCommentTerminal, isRegexToken, isTerminalRule, terminalRegex } from 'langium';
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

    const commentRules: State = {
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
        commentRules
    ];
}

/**
 * Pretty prints a monarch grammar into it's concrete form, suitable for writing to a file
 * @param monarchGrammar Grammar to pretty print
 * @returns Monarch grammar in concrete form, suitable for writing to a file
 */
function prettyPrint(monarchGrammar: MonarchGrammar): string {
    const name = monarchGrammar.languageDefinition.name;
    return ([
        `// Monarch syntax highlighting for the ${name} language.`,
        `export const language${name} = {\n`,

        // add language definitions
        prettyPrintLangDef(monarchGrammar.languageDefinition),

        // add folding
        '\tfolding: {',
        '\t\tmarkers: {',
        '\t\t\tstart: new RegExp(\'^\\s*//\\s*#?region\\b\'),',
        '\t\t\tend: new RegExp(\'^\\s*//\\s*#?endregion\\b\')',
        '\t\t}',
        '\t},\n',

        // add tokenizer parts, simple state machine groupings
        prettyPrintTokenizer(monarchGrammar.tokenizer),

        '};'
    ].join('\n')).replaceAll(/\t/g, '    ');
}

/**
 * Generates an entry for a language definition, given a name (token category) and values
 * @param name Category of language definition to add
 * @param values Values to add under the given category
 * @param fmt Formatter to keep things indented
 * @returns A string of this language def entry, for use in a monarch file
 */
function genLanguageDefEntry(name: string, values: string[], fmt: Formatter): string {
    return [
        `${name}: [`,
        '\t' + values.map(v => `'${v}'`).join(','),
        '],'
    ].map(fmt).join('\n');
}

/**
 * Pretty prints the language definition portion of a Monarch grammar
 * @param languageDef LanguageDefinition to pretty print
 * @returns LanguageDefinition in concrete form
 */
function prettyPrintLangDef(languageDef: LanguageDefinition): string {
    const content = [
        genLanguageDefEntry('keywords', languageDef.keywords, indent),
        genLanguageDefEntry('operators', languageDef.operators, indent),
        // special case, identify symbols via singular regex
        indent('symbols:  /' +  languageDef.symbols.join('|') + '/,')
    ];
    return content.join('\n') + '\n';
}

/**
 * Pretty prints the tokenizer portion of a Monarch grammar file
 * @param tokenizer Tokenizer portion to print out
 * @returns Tokenizer in concrete form
 */
function prettyPrintTokenizer(tokenizer: Tokenizer): string {
    return [
        '\ttokenizer: {',
        tokenizer.states.map(state => prettyPrintState(state, (s => indent(indent(s))))).join('\n'),
        '\t}'
    ].join('\n');
}

/**
 * Pretty prints a tokenizer state, composed of various rules
 * @param state Tokenizer state to pretty print
 * @param fmt Formatter to set indentation
 * @returns Tokenizer state in concrete form
 */
function prettyPrintState(state: State, fmt: Formatter): string {
    return [
        fmt(state.name + ': ['),
        state.rules.map(rule => fmt(prettyPrintRule(rule, indent))).join('\n'),
        fmt('],')
    ].join('\n');
}

/**
 * Pretty prints a Rule.
 * This can either be a literal rule to match w/ an action, or a reference to a state to include here
 * @param ruleOrState Rule to pretty print. If it's a state, we include that state's contents implicitly within this context.
 * @param fmt Formatter to track indentation
 * @returns Rule in concrete form
 */
function prettyPrintRule(ruleOrState: Rule | State, fmt: Formatter): string {
    if(isRule(ruleOrState)) {
        // extract rule pattern, either just a string or a regex w/ parts
        const rulePatt = ruleOrState.regex instanceof RegExp ? getTerminalParts(ruleOrState.regex).join('') : `/${ruleOrState.regex}/`;
        return fmt('{ regex: ' + rulePatt + ', action: ' + prettyPrintAction(ruleOrState.action) + ' },');
    } else {
        // include another state by name, implicitly includes all of its contents
        return fmt(`{ include: '@${ruleOrState.name}' },`);
    }
}

/**
 * Pretty prints the action of a Rule
 * @param action Action to print. Can have several keywords to control what the state machine should do next.
 * @returns Action in concrete form
 */
function prettyPrintAction(action: Action | Case[]): string {
    if(!Array.isArray(action)) {
        // plain action
        return JSON.stringify(action);
    } else {
        // array of cases, each with an action
        const prettyCases: string = action.map(c => `'${c.guard}': ` + prettyPrintAction(c.action)).join(', ');
        return '{ cases: { ' + prettyCases + ' }}';
    }
}

/**
 * Convert a deafult Langium token names to a monarch one
 * @param name Token name to convert
 * @returns Returns the equivalent monarch name, or the original token name
 */
function getMonarchTokenName(name: string): string {
    if(name === 'WS') {
        return 'white';
    } else if (name === 'ML_COMMENT' || name === 'SL_COMMENT') {
        return 'comment';
    } else if (name === 'STRING') {
        return 'string';
    } else if (name === 'INT') {
        return 'number';
    } else if (name === 'BIGINT') {
        return 'number.float';
    } else if (name === 'ID') {
        return 'identifier';
    } else {
        // fallback to the original name
        return name;
    }
}

/**
 * Gets whitespace rules from the langium grammar. Includes starting comment sequence
 * @param grammar Langium grammar to extract whitespace rules from
 * @returns Array of Monarch whitespace rules
 */
function getWhitespaceRules(grammar: langium.Grammar): Rule[] {
    const rules: Rule[] = [];
    for(const rule of grammar.rules) {
        if(isTerminalRule(rule) && (isCommentTerminal(rule) || rule.name === 'WS') && isRegexToken(rule.definition)) {
            const tokenName = getMonarchTokenName(rule.name);
            const part = getTerminalParts(terminalRegex(rule))[0];
            if(part.start !== '' && part.end !== '' && tokenName === 'comment') {
                // state-based rule, only add push to jump into it
                rules.push({
                    regex: part.start.replace('/', '\\/'),
                    action: { token: tokenName, next: '@' + tokenName }
                });

            } else {
                // single regex rule
                rules.push({
                    regex: rule.definition.regex,
                    action: {token: getMonarchTokenName(rule.name) }
                });
            }
        }
    }
    return rules;
}

/**
 * Gets comment state rules from the Langium grammar. Accounts for nested multi-line comments.
 * @param grammar Langium grammar to extract comment rules from
 * @returns Array of Monarch comment rules
 */
function getCommentRules(grammar: langium.Grammar): Rule[] {
    const rules: Rule[] = [];
    for(const rule of grammar.rules) {
        if(isTerminalRule(rule) && (isCommentTerminal(rule) || rule.name === 'WS') && isRegexToken(rule.definition)) {
            const tokenName = getMonarchTokenName(rule.name);
            const part = getTerminalParts(terminalRegex(rule))[0];
            if(part.start !== '' && part.end !== '' && tokenName === 'comment') {
                // rules to manage comment nesting via push/pop
                // rule order matters

                const start = part.start.replace('/', '\\/');
                const end   = part.end.replace('/', '\\/');

                // 1st, add anything that's not in the start sequence
                rules.push({
                    regex: `[^${start}]+`,
                    action: { token: tokenName }
                });

                // 2nd, otherwise if start seq, push this state again for nesting
                rules.push({
                    regex: start,
                    action: { token: tokenName, next: '@push' }
                });

                // 3rd, end of sequence, pop this state, keeping others on the stack
                rules.push({
                    regex: end,
                    action: { token: tokenName, next: '@pop' }
                });

                // 4th, otherwise, start sequence characters are OK in this state
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
        if (isTerminalRule(rule) && !isCommentTerminal(rule) && rule.name !== 'WS' && isRegexToken(rule.definition)) {
            const tokenName = getMonarchTokenName(rule.name);
            // default action...
            let action: Action | Case[] = { token: tokenName };

            if(tokenName === 'identifier') {
                // for identifiers, add case to handle keywords as well,
                // so they aren't tagged incorrectly as IDs
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
 * @param grammar Gramamr to get keywords from
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

/**
 * General formatter type to help with nested indentation
 */
 type Formatter = (line: string) => string;

/**
 * Adds single indentation to string
 * @param s String to print w/ an extra indent
 * @returns Singly indented string
 */
function indent(s: string): string {
    return '\t' + s;
}
