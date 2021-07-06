/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { getContainerOfType, getTypeName, NLEmpty, ParserRule, stream } from 'langium';
import { CompositeGeneratorNode, GeneratorNode, NL, processGeneratorNode, replaceTokens } from 'langium';
import { collectAst } from './type-collector';
import { Cardinality, findAllFeatures, isDataTypeRule, isOptional } from 'langium';
import { LangiumConfig } from '../package';
import { collectKeywords, generatedHeader } from './util';

type RuleContext = {
    name: string,
    option: number,
    consume: number,
    subrule: number,
    many: number,
    or: number,
    featureMap: Map<langium.AbstractElement, string>
}

export function generateParser(grammar: langium.Grammar, config: LangiumConfig): string {
    const keywords = collectKeywords(grammar);

    const fileNode = new CompositeGeneratorNode();
    fileNode.append(
        generatedHeader,
        '/* eslint-disable */', NL,
        '// @ts-nocheck', NL,
        "import { createToken, Lexer } from 'chevrotain';", NL
    );
    if (config.langiumInternal) {
        fileNode.append(
            "import { LangiumServices } from '../../services';", NL,
            "import { LangiumParser, DatatypeSymbol } from '../../parser/langium-parser';", NL
        );
    } else {
        fileNode.append("import { LangiumParser, LangiumServices, DatatypeSymbol } from 'langium';", NL);
    }
    fileNode.append(
        'import { ', grammar.name, "GrammarAccess } from './grammar-access';", NL,
        'import {'
    );
    const types = collectAst(grammar);
    for (const type of types) {
        fileNode.append(' ', type.name, ',');
    }
    fileNode.append(" } from './ast';", NL, NL);

    const tokens: Array<{ name: string, length: number, node: CompositeGeneratorNode }> = [];
    const terminals = grammar.rules
        .filter(e => langium.isTerminalRule(e))
        .map(e => e as langium.TerminalRule)
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const terminal of terminals) {
        tokens.push(buildTerminalToken(grammar, terminal));
    }
    let keywordTokens: Array<{ name: string, length: number, node: CompositeGeneratorNode }> = [];
    for (const keyword of keywords) {
        keywordTokens.push(buildKeywordToken(keyword, keywords, terminals));
    }
    keywordTokens = keywordTokens.sort((a, b) => a.name.localeCompare(b.name)).sort((a, b) => b.length - a.length);
    for (const token of tokens) {
        fileNode.append(token.node, NL);
    }
    for (const keyword of keywordTokens) {
        fileNode.append(keyword.node, NL);
    }

    fileNode.append(NL);

    for (const keyword of keywords) {
        const token = buildKeywordToken(keyword, keywords, terminals);
        fileNode.append(token.name, '.LABEL = "', "'", keyword, "'\";", NL);
    }

    fileNode.append(
        'const tokens = [',
        keywordTokens.map(e => e.name).join(', ') + ', ' + tokens.map(e => e.name).join(', '), '];',
        NL, NL
    );

    fileNode.append(buildParser(grammar), NL);

    return processGeneratorNode(fileNode);
}

function buildParser(grammar: langium.Grammar): CompositeGeneratorNode {
    const parserNode = new CompositeGeneratorNode();

    parserNode.append('export class Parser extends LangiumParser {', NL);

    parserNode.indent(classBody => {
        classBody.append('readonly grammarAccess: ', grammar.name, 'GrammarAccess;', NL, NL);

        classBody.append('constructor(services: LangiumServices) {', NL);
        classBody.indent(constructorBody => {
            constructorBody.append(
                'super(tokens, services);', NL
            );
        });
        classBody.append('}', NL, NL);

        let first = true;
        for (const rule of stream(grammar.rules).filterType(langium.isParserRule)) {
            const ctx: RuleContext = {
                name: rule.name,
                consume: 1,
                option: 1,
                subrule: 1,
                many: 1,
                or: 1,
                featureMap: findAllFeatures(rule).byFeature
            };
            classBody.append(buildRule(ctx, rule, first));
            first = false;
        }
    });
    parserNode.contents.push('}');

    return parserNode;
}

function buildRule(ctx: RuleContext, rule: ParserRule, first: boolean): CompositeGeneratorNode {
    const ruleNode = new CompositeGeneratorNode();
    ruleNode.append(rule.name);

    let type = 'undefined';

    if (!rule.fragment) {
        if (isDataTypeRule(rule)) {
            type = 'DatatypeSymbol';
        } else {
            type = getTypeName(rule);
        }
    }

    ruleNode.append(
        ' = this.', first ? 'MAIN_RULE("' : 'DEFINE_RULE("',
        rule.name, '", ', type, ', () => {', NL
    );

    ruleNode.indent(ruleContent => {
        ruleContent.append(
            'this.initializeElement(this.grammarAccess.', ctx.name, ');', NLEmpty,
            buildElement(ctx, rule.alternatives), NLEmpty,
            buildRuleReturnStatement()
        );
    });
    ruleNode.append('});', NL, NL);

    return ruleNode;
}

function buildRuleReturnStatement(): CompositeGeneratorNode {
    return new CompositeGeneratorNode('return this.construct();', NLEmpty);
}

function buildUnorderedGroup(ctx: RuleContext, group: langium.UnorderedGroup): CompositeGeneratorNode {
    if (langium.isGroup(group)) {
        return buildGroup(ctx, group);
    } else {
        throw new Error('Unordered groups are not supported (yet)');
    }
}

function buildGroup(ctx: RuleContext, group: langium.Group): CompositeGeneratorNode {
    const groupNode = new CompositeGeneratorNode();

    for (const element of group.elements) {
        groupNode.append(buildElement(ctx, element), NLEmpty);
    }

    return groupNode;
}

function buildAction(ctx: RuleContext, action: langium.Action): GeneratorNode {
    return `this.action(${action.type}, ${getGrammarAccess(ctx, action)});`;
}

function buildElement(ctx: RuleContext, terminal: langium.AbstractElement): GeneratorNode {
    let node: GeneratorNode;
    if (langium.isKeyword(terminal)) {
        node = buildKeyword(ctx, terminal);
    } else if (langium.isAction(terminal)) {
        node = buildAction(ctx, terminal);
    } else if (langium.isAssignment(terminal)) {
        node = buildElement(ctx, terminal.terminal);
    } else if (langium.isCrossReference(terminal)) {
        node = buildCrossReferenceTerminal(ctx, terminal);
    } else if (langium.isRuleCall(terminal)) {
        node = buildRuleCall(ctx, terminal);
    } else if (langium.isAlternatives(terminal)) {
        node = buildAlternatives(ctx, terminal);
    } else if (langium.isUnorderedGroup(terminal)) {
        node = buildUnorderedGroup(ctx, terminal);
    } else if (langium.isGroup(terminal)) {
        node = buildGroup(ctx, terminal);
    } else {
        node = '';
    }
    return wrap(ctx, node, terminal.cardinality);
}

function buildCrossReferenceTerminal(ctx: RuleContext, crossRef: langium.CrossReference): GeneratorNode {
    const terminal = crossRef.terminal;
    if (!terminal) {
        return `this.consume(${ctx.consume++}, ID, ${getGrammarAccess(ctx, crossRef)});`;
    } else if (langium.isRuleCall(terminal) && langium.isParserRule(terminal.rule.ref)) {
        return `this.subrule(${ctx.subrule++}, this.${terminal.rule.ref.name}, ${getGrammarAccess(ctx, crossRef)});`;
    } else if (langium.isRuleCall(terminal) && langium.isTerminalRule(terminal.rule.ref)) {
        return `this.consume(${ctx.consume++}, ${terminal.rule.ref.name}, ${getGrammarAccess(ctx, crossRef)});`;
    } else {
        return '';
    }
}

function buildAlternatives(ctx: RuleContext, alternatives: langium.Alternatives): GeneratorNode {
    if (alternatives.elements.length === 1) {
        return buildElement(ctx, alternatives.elements[0]);
    } else {
        const wrapper = new CompositeGeneratorNode(`this.or(${ctx.or++}, [`, NL);

        for (const element of alternatives.elements) {
            wrapper.indent(altIndent => {
                altIndent.append('() => {', NL);
                altIndent.indent(contentIndent => {
                    contentIndent.append(buildElement(ctx, element), NLEmpty);
                });
                altIndent.append('},', NL);
            });
        }

        wrapper.append(']);', NL);

        return wrapper;
    }
}

function wrap(ctx: RuleContext, node: GeneratorNode, cardinality: Cardinality): GeneratorNode {
    if (!cardinality) {
        return node;
    } else {
        const wrapper = new CompositeGeneratorNode();
        if (cardinality === '*') {
            wrapper.append(`this.many(${ctx.many++}, () => {`, NL);
        } else if (cardinality === '+') {
            wrapper.append(`this.atLeastOne(${ctx.many++}, () => {`, NL);
        } else if (isOptional(cardinality)) {
            wrapper.append(`this.option(${ctx.option++}, () => {`, NL);
        }
        wrapper.indent(indent => {
            indent.append(node, NLEmpty);
        });
        wrapper.append('});');
        return wrapper;
    }
}

function buildRuleCall(ctx: RuleContext, ruleCall: langium.RuleCall): string {
    const rule = ruleCall.rule.ref;
    if (langium.isParserRule(rule)) {
        if (getContainerOfType(ruleCall, langium.isAssignment)) {
            return `this.subrule(${ctx.subrule++}, this.${rule.name}, ${getGrammarAccess(ctx, ruleCall)});`;
        } else {
            return `this.unassignedSubrule(${ctx.subrule++}, this.${rule.name}, ${getGrammarAccess(ctx, ruleCall)});`;
        }
    } else if (langium.isTerminalRule(rule)) {
        return `this.consume(${ctx.consume++}, ${rule.name}, ${getGrammarAccess(ctx, ruleCall)});`;
    }

    return '';
}

function buildKeyword(ctx: RuleContext, keyword: langium.Keyword): string {
    const validName = replaceTokens(keyword.value) + 'Keyword';
    const node = `this.consume(${ctx.consume++}, ${validName}, ${getGrammarAccess(ctx, keyword)});`;
    return node;
}

function getGrammarAccess(ctx: RuleContext, feature: langium.AbstractElement): string {
    return `this.grammarAccess.${ctx.name}.${ctx.featureMap.get(feature)}`;
}

function buildTerminalToken(grammar: langium.Grammar, terminal: langium.TerminalRule): { name: string, length: number, node: CompositeGeneratorNode } {
    const terminalNode = new CompositeGeneratorNode();
    terminalNode.append(
        'const ',
        terminal.name,
        " = createToken({ name: '",
        terminal.name,
        "', pattern: ",
        terminal.regex);

    if (grammar.hiddenTokens && grammar.hiddenTokens.map(e => e.ref).includes(terminal)) {
        const regex = terminal.regex.substring(1, terminal.regex.length - 1);
        if (new RegExp(regex).test(' ')) { // Only skip tokens that are able to accept whitespace
            terminalNode.append(', group: Lexer.SKIPPED');
        } else {
            terminalNode.append(", group: 'hidden'");
        }
    }

    terminalNode.append(' });');

    return { name: terminal.name, length: terminal.regex.length, node: terminalNode };
}

function buildKeywordToken(keyword: string, keywords: string[], terminals: langium.TerminalRule[]): { name: string, length: number, node: CompositeGeneratorNode } {
    const keywordNode = new CompositeGeneratorNode();
    const longerAlt = findLongerAlt(keyword, keywords, terminals);
    const validName = replaceTokens(keyword) + 'Keyword';
    keywordNode.append('const ', validName, " = createToken({ name: '", validName, "', pattern: /", escapeRegExp(keyword), '/');

    if (longerAlt) {
        keywordNode.append(', longer_alt: ', longerAlt);
    }

    keywordNode.append(' });');
    return { name: validName, length: keyword.length, node: keywordNode };
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function findLongerAlt(keyword: string, keywords: string[], terminals: langium.TerminalRule[]): string | undefined {
    const starter = "'" + keyword;
    const longerKeywords = keywords.filter(e => e.length > keyword.length + 2 && e.startsWith(starter));
    if (longerKeywords.length > 0) {
        let shortest = longerKeywords[0];
        for (const key of longerKeywords) {
            if (key.length < shortest.length) {
                shortest = key;
            }
        }
        return replaceTokens(shortest) + 'Keyword';
    }
    // TODO: for now, just return id
    return terminals.find(e => e.name === 'ID')?.name;
}
