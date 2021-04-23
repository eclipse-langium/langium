import { AbstractElement, Action, Alternatives, Assignment, CrossReference, Grammar, Group, Keyword, ParserRule, RuleCall, TerminalRule, UnorderedGroup } from '../gen/ast';
import { getTypeName } from '../grammar/grammar-utils';
import { AstNode } from './ast-node';
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode, NL } from './node/node';
import { process } from './node/node-processor';
import { replaceTokens } from './token-replacer';
import { collectAst } from './type-collector';
import { findAllFeatures } from './utils';

type RuleContext = {
    name: string,
    option: number,
    consume: number,
    subrule: number,
    many: number,
    or: number,
    featureMap: Map<AbstractElement, string>
}

export function generateParser(grammar: Grammar, path?: string): string {
    const keywords = collectKeywords(grammar);
    const langiumPath = "'" + (path ?? 'langium') + "'";

    const fileNode = new CompositeGeneratorNode();
    fileNode.children.push(
        '/* eslint-disable */', NL,
        '// @ts-nocheck', NL,
        "import { createToken, Lexer } from 'chevrotain';", NL,
        'import { LangiumParser } from ', langiumPath, ';', NL,
        'import { ' + grammar.name + "GrammarAccess } from './grammar-access';", NL,
    );

    fileNode.children.push('import {');
    const types = collectAst(grammar);
    for (const type of types) {
        fileNode.children.push(' ', type.name, ',');
    }
    fileNode.children.push(" } from './ast';", NL, NL);

    const tokens: Array<{ name: string, length: number, node: CompositeGeneratorNode }> = [];
    const terminals = grammar.rules.filter(e => TerminalRule.is(e)).map(e => e as TerminalRule);

    for (const terminal of terminals) {
        tokens.push(buildTerminalToken(grammar, terminal));
    }
    let keywordTokens: Array<{ name: string, length: number, node: CompositeGeneratorNode }> = [];
    for (const keyword of keywords) {
        keywordTokens.push(buildKeywordToken(keyword, keywords, terminals));
    }
    keywordTokens = keywordTokens.sort((a, b) => b.length - a.length);
    for (const token of tokens) {
        fileNode.children.push(token.node, NL);
    }
    for (const keyword of keywordTokens) {
        fileNode.children.push(keyword.node, NL);
    }

    fileNode.children.push(NL);

    for (const keyword of keywords) {
        const token = buildKeywordToken(keyword, keywords, terminals);
        fileNode.children.push(token.name, '.LABEL = "', "'", keyword.substring(1, keyword.length - 1), "'\";", NL);
    }

    const tokenListNode = new CompositeGeneratorNode();
    tokenListNode.children.push(
        'const tokens = [',
        keywordTokens.map(e => e.name).join(', ') + ', ' + tokens.map(e => e.name).join(', '),
        '];', NL
    );

    fileNode.children.push(tokenListNode, NL);
    fileNode.children.push('const lexer = new Lexer(tokens);', NL);

    fileNode.children.push(buildParser(grammar), NL, NL);

    fileNode.children.push('let parser: Parser | undefined;', NL, NL);

    fileNode.children.push(buildParseFunction(grammar));
    return process(fileNode);
}

function buildParseFunction(grammar: Grammar): CompositeGeneratorNode {
    const parseFunction = new CompositeGeneratorNode();
    parseFunction.children.push(
        'export function parse(grammarAccess: ', grammar.name, 'GrammarAccess, text: string) {', NL);
    const parseBody = new IndentNode();
    parseBody.children.push(
        'if (!parser) {', NL,
        '    parser = new Parser(grammarAccess);', NL, '}', NL,
        'const lexResult = lexer.tokenize(text);', NL,
        'parser.input = lexResult.tokens;', NL,
        'const ast = parser.parse(text);', NL,
        'return {', NL
    );

    const resultObj = new IndentNode();
    resultObj.children.push(
        'ast,', NL,
        'lexErrors: lexResult.errors,', NL,
        'parseErrors: parser.errors', NL
    );

    parseBody.children.push(resultObj, '}', NL);
    parseFunction.children.push(parseBody, '}', NL);
    return parseFunction;
}

function buildParser(grammar: Grammar): CompositeGeneratorNode {
    const parserNode = new CompositeGeneratorNode();

    parserNode.children.push('export class Parser extends LangiumParser {', NL);

    const classBody = new IndentNode();
    classBody.children.push('grammarAccess: ', grammar.name, 'GrammarAccess;', NL);
    classBody.children.push('constructor(grammarAccess: ', grammar.name, 'GrammarAccess) {', NL);

    const constructorBody = new IndentNode();
    constructorBody.children.push(
        'super(tokens);', NL,
        'this.grammarAccess = grammarAccess;', NL,
        'this.performSelfAnalysis();', NL
    );

    classBody.children.push(constructorBody, '}', NL, NL);

    let first = true;
    for (const rule of grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule)) {
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
    ruleNode.children.push('private ', rule.name);

    ruleNode.children.push(
        ' = this.', first ? 'MAIN_RULE("' : 'DEFINE_RULE("',
        rule.name, '", ', rule.fragment ? 'undefined' : getTypeName(rule) + '.kind',
        ', () => {', NL
    );

    const ruleContent = new IndentNode();
    ruleNode.children.push(ruleContent);
    ruleContent.children.push(buildElement(ctx, rule.alternatives), new NewLineNode(undefined, true));
    ruleContent.children.push(buildRuleReturnStatement(rule));

    ruleNode.children.push('})', NL, NL);

    return ruleNode;
}

function buildRuleReturnStatement(rule: ParserRule): CompositeGeneratorNode {
    const node = new CompositeGeneratorNode();
    node.children.push('return this.construct<', getTypeName(rule), '>();', new NewLineNode(undefined, true));
    return node;
}

function buildUnorderedGroup(ctx: RuleContext, group: UnorderedGroup): CompositeGeneratorNode {
    if (Group.is(group)) {
        return buildGroup(ctx, group);
    } else {
        throw new Error('Unordered groups are not supported (yet)');
    }
}

function buildGroup(ctx: RuleContext, group: Group): CompositeGeneratorNode {
    const groupNode = new CompositeGeneratorNode();

    for (const element of group.elements) {
        const terminalNode = buildElement(ctx, element);
        groupNode.children.push(wrap(ctx, terminalNode, element.cardinality), new NewLineNode(undefined, true));
    }

    return groupNode;
}

function buildAction(ctx: RuleContext, action: Action): GeneratorNode {
    return 'this.executeAction(' + action.type + '.kind, ' + getGrammarAccess(ctx, action) + ');';
}

function buildElement(ctx: RuleContext, terminal: AbstractElement): GeneratorNode {
    if (Keyword.is(terminal)) {
        return buildKeyword(ctx, terminal);
    } else if (Action.is(terminal)) {
        return buildAction(ctx, terminal);
    } else if (Assignment.is(terminal)) {
        return buildElement(ctx, terminal.terminal);
    } else if (CrossReference.is(terminal)) {
        return 'this.consumeLeaf(' + ctx.consume++ + ', ID, ' + getGrammarAccess(ctx, terminal) + ');';
    } else if (RuleCall.is(terminal)) {
        return buildRuleCall(ctx, terminal);
    } else if (Alternatives.is(terminal)) {
        return buildAlternatives(ctx, terminal);
    } else if (UnorderedGroup.is(terminal)) {
        return buildUnorderedGroup(ctx, terminal);
    } else if (Group.is(terminal)) {
        return buildGroup(ctx, terminal);
    } else {
        return '';
    }
}

function buildAlternatives(ctx: RuleContext, alternatives: Alternatives): GeneratorNode {
    if (alternatives.elements.length === 1) {
        return buildElement(ctx, alternatives.elements[0]);
    } else {
        const wrapper = new CompositeGeneratorNode();
        wrapper.children.push('this.or(', (ctx.or++).toString(), ', [', NL);
        const altWrapper = new IndentNode();
        wrapper.children.push(altWrapper);

        for (const element of alternatives.elements) {
            altWrapper.children.push('{', NL);
            const altIndent = new IndentNode();
            const contentIndent = new IndentNode();
            altIndent.children.push('ALT: () => {', NL, contentIndent, '}', NL);
            const elementNode = buildElement(ctx, element);
            contentIndent.children.push(wrap(ctx, elementNode, element.cardinality), new NewLineNode(undefined, true));
            altWrapper.children.push(altIndent, '},', NL);
        }

        wrapper.children.push(']);', NL);

        return wrapper;
    }
}

function wrap(ctx: RuleContext, node: GeneratorNode, cardinality: string | undefined): GeneratorNode {
    if (!cardinality) {
        return node;
    } else {
        const wrapper = new CompositeGeneratorNode();
        if (cardinality === '*' || cardinality === '+') {
            wrapper.children.push('this.many(' + ctx.many++ + ', () => {', NL);
        } else if (cardinality === '?') {
            wrapper.children.push('this.option(' + ctx.option++ + ', () => {', NL);
        }

        const indent = new IndentNode();
        indent.children.push(node, new NewLineNode(undefined, true));
        wrapper.children.push(indent, '});');

        return wrapper;
    }
}

function buildRuleCall(ctx: RuleContext, ruleCall: RuleCall): string {
    const rule = ruleCall.rule.value;
    if (ParserRule.is(rule)) {
        if (AstNode.getContainer(ruleCall, Assignment.kind)) {
            return 'this.subruleLeaf(' + ctx.subrule++ + ', this.' + rule.name + ', ' + getGrammarAccess(ctx, ruleCall) + ');';
        } else {
            return 'this.unassignedSubrule(' + ctx.subrule++ + ', this.' + rule.name + ', ' + getGrammarAccess(ctx, ruleCall) + ');';
        }
    } else if (TerminalRule.is(rule)) {
        return 'this.consumeLeaf(' + ctx.consume++ + ', ' + rule.name + ', ' + getGrammarAccess(ctx, ruleCall) + ');';
    }

    return '';
}

function buildKeyword(ctx: RuleContext, keyword: Keyword): string {
    const validName = replaceTokens(keyword.value) + 'Keyword';
    const node = 'this.consumeLeaf(' + ctx.consume++ + ', ' + validName + ', ' + getGrammarAccess(ctx, keyword) + ');';
    return node;
}

function getGrammarAccess(ctx: RuleContext, feature: AbstractElement): string {
    return 'this.grammarAccess.' + ctx.name + '.' + ctx.featureMap.get(feature);
}

function buildTerminalToken(grammar: Grammar, terminal: TerminalRule): { name: string, length: number, node: CompositeGeneratorNode } {
    const terminalNode = new CompositeGeneratorNode();
    terminalNode.children.push(
        'const ',
        terminal.name,
        " = createToken({ name : '",
        terminal.name,
        "', pattern: ",
        terminal.regex);

    if (grammar.hiddenTokens && grammar.hiddenTokens.map(e => e.value).includes(terminal)) {
        terminalNode.children.push(', group: Lexer.SKIPPED');
    }

    terminalNode.children.push(' });');

    return { name: terminal.name, length: terminal.regex.length, node: terminalNode };
}

function buildKeywordToken(keyword: string, keywords: string[], terminals: TerminalRule[]): { name: string, length: number, node: CompositeGeneratorNode } {
    const keywordNode = new CompositeGeneratorNode();
    const fixed = keyword.substring(1, keyword.length - 1);
    const longerAlt = findLongerAlt(fixed, keywords, terminals);
    const validName = replaceTokens(keyword) + 'Keyword';
    keywordNode.children.push('const ', validName, " = createToken({ name: '", validName, "', pattern: /", escapeRegExp(fixed), '/');

    if (longerAlt) {
        keywordNode.children.push(', longer_alt: ', longerAlt);
    }

    keywordNode.children.push(' });');
    return { name: validName, length: keyword.length, node: keywordNode };
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findLongerAlt(keyword: string, keywords: string[], terminals: TerminalRule[]): string | undefined {
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

function collectKeywords(grammar: Grammar): string[] {
    const keywords = new Set<string>();

    for (const rule of grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule)) {
        collectElementKeywords(rule.alternatives, keywords);
    }

    return Array.from(keywords);
}

function collectElementKeywords(element: AbstractElement, keywords: Set<string>) {
    if (Alternatives.is(element) || Group.is(element) || UnorderedGroup.is(element)) {
        for (const item of element.elements) {
            collectElementKeywords(item, keywords);
        }
    } else if (Assignment.is(element)) {
        collectElementKeywords(element.terminal, keywords);
    } else if (Keyword.is(element)) {
        keywords.add(element.value);
    }
}
