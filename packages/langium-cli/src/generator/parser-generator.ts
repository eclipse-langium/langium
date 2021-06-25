/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { getContainerOfType, getTypeName, ParserRule, stream } from 'langium';
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode, NL, processNode, replaceTokens } from 'langium';
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
    fileNode.children.push(
        generatedHeader,
        '/* eslint-disable */', NL,
        '// @ts-nocheck', NL,
        "import { createToken, Lexer } from 'chevrotain';", NL
    );
    if (config.langiumInternal) {
        fileNode.children.push("import { LangiumServices } from '../../services';", NL);
        fileNode.children.push("import { LangiumParser, DatatypeSymbol } from '../../parser/langium-parser';", NL);
    } else {
        fileNode.children.push("import { LangiumParser, LangiumServices, DatatypeSymbol } from 'langium';", NL);
    }
    fileNode.children.push('import { ', grammar.name, "GrammarAccess } from './grammar-access';", NL);

    fileNode.children.push('import {');
    const types = collectAst(grammar);
    for (const type of types) {
        fileNode.children.push(' ', type.name, ',');
    }
    fileNode.children.push(" } from './ast';", NL, NL);

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
        fileNode.children.push(token.node, NL);
    }
    for (const keyword of keywordTokens) {
        fileNode.children.push(keyword.node, NL);
    }

    fileNode.children.push(NL);

    for (const keyword of keywords) {
        const token = buildKeywordToken(keyword, keywords, terminals);
        fileNode.children.push(token.name, '.LABEL = "', "'", keyword, "'\";", NL);
    }

    const tokenListNode = new CompositeGeneratorNode();
    tokenListNode.children.push(
        'const tokens = [',
        keywordTokens.map(e => e.name).join(', ') + ', ' + tokens.map(e => e.name).join(', '),
        '];', NL
    );

    fileNode.children.push(tokenListNode, NL);

    fileNode.children.push(buildParser(grammar), NL);

    return processNode(fileNode);
}

function buildParser(grammar: langium.Grammar): CompositeGeneratorNode {
    const parserNode = new CompositeGeneratorNode();

    parserNode.children.push('export class Parser extends LangiumParser {', NL);

    const classBody = new IndentNode();
    classBody.children.push('readonly grammarAccess: ', grammar.name, 'GrammarAccess;', NL, NL);

    classBody.children.push('constructor(services: LangiumServices) {', NL);
    const constructorBody = new IndentNode();
    constructorBody.children.push(
        'super(tokens, services);', NL
    );
    classBody.children.push(constructorBody, '}', NL, NL);

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
        classBody.children.push(buildRule(ctx, rule, first));
        first = false;
    }

    parserNode.children.push(classBody, '}');

    return parserNode;
}

function buildRule(ctx: RuleContext, rule: ParserRule, first: boolean): CompositeGeneratorNode {
    const ruleNode = new CompositeGeneratorNode();
    ruleNode.children.push(rule.name);

    let type = 'undefined';

    if (!rule.fragment) {
        if (isDataTypeRule(rule)) {
            type = 'DatatypeSymbol';
        } else {
            type = getTypeName(rule);
        }
    }

    ruleNode.children.push(
        ' = this.', first ? 'MAIN_RULE("' : 'DEFINE_RULE("',
        rule.name, '", ', type, ', () => {', NL
    );

    const ruleContent = new IndentNode();
    ruleNode.children.push(ruleContent);
    ruleContent.children.push('this.initializeElement(this.grammarAccess.', ctx.name, ');', new NewLineNode(undefined, true));
    ruleContent.children.push(buildElement(ctx, rule.alternatives), new NewLineNode(undefined, true));
    ruleContent.children.push(buildRuleReturnStatement());
    ruleNode.children.push('});', NL, NL);

    return ruleNode;
}

function buildRuleReturnStatement(): CompositeGeneratorNode {
    const node = new CompositeGeneratorNode();
    node.children.push('return this.construct();', new NewLineNode(undefined, true));
    return node;
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
        groupNode.children.push(buildElement(ctx, element), new NewLineNode(undefined, true));
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
        const wrapper = new CompositeGeneratorNode();
        wrapper.children.push(`this.or(${ctx.or++}, [`, NL);

        for (const element of alternatives.elements) {
            const altIndent = new IndentNode();
            wrapper.children.push(altIndent);
            const contentIndent = new IndentNode();
            altIndent.children.push('() => {', NL, contentIndent, '},', NL);
            contentIndent.children.push(buildElement(ctx, element), new NewLineNode(undefined, true));
        }

        wrapper.children.push(']);', NL);

        return wrapper;
    }
}

function wrap(ctx: RuleContext, node: GeneratorNode, cardinality: Cardinality): GeneratorNode {
    if (!cardinality) {
        return node;
    } else {
        const wrapper = new CompositeGeneratorNode();
        if (cardinality === '*') {
            wrapper.children.push(`this.many(${ctx.many++}, () => {`, NL);
        } else if (cardinality === '+') {
            wrapper.children.push(`this.atLeastOne(${ctx.many++}, () => {`, NL);
        } else if (isOptional(cardinality)) {
            wrapper.children.push(`this.option(${ctx.option++}, () => {`, NL);
        }

        const indent = new IndentNode();
        indent.children.push(node, new NewLineNode(undefined, true));
        wrapper.children.push(indent, '});');

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
    terminalNode.children.push(
        'const ',
        terminal.name,
        " = createToken({ name: '",
        terminal.name,
        "', pattern: ",
        terminal.regex);

    if (grammar.hiddenTokens && grammar.hiddenTokens.map(e => e.ref).includes(terminal)) {
        terminalNode.children.push(', group: Lexer.SKIPPED');
    }

    terminalNode.children.push(' });');

    return { name: terminal.name, length: terminal.regex.length, node: terminalNode };
}

function buildKeywordToken(keyword: string, keywords: string[], terminals: langium.TerminalRule[]): { name: string, length: number, node: CompositeGeneratorNode } {
    const keywordNode = new CompositeGeneratorNode();
    const longerAlt = findLongerAlt(keyword, keywords, terminals);
    const validName = replaceTokens(keyword) + 'Keyword';
    keywordNode.children.push('const ', validName, " = createToken({ name: '", validName, "', pattern: /", escapeRegExp(keyword), '/');

    if (longerAlt) {
        keywordNode.children.push(', longer_alt: ', longerAlt);
    }

    keywordNode.children.push(' });');
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
