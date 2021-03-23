/* eslint-disable */
import { AbstractTerminal, Action, Alternatives, AssignableTerminal, Assignment, Grammar, Group, Keyword, ParenthesizedAssignableElement, ParenthesizedElement, ParserRule, RuleCall, TerminalRule, UnorderedGroup } from "../gen/ast";
import { CompositeGeneratorNode, GeneratorNode, IndentNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { replaceTokens } from "./token-replacer";
import { Feature, findAllFeatures } from "./utils";

type RuleContext = {
    name: string,
    option: number,
    consume: number,
    subrule: number,
    many: number,
    or: number,
    featureMap: Map<Feature, string>
}

export function generateParser(grammar: Grammar, bootstrap = false): string {
    const keywords = collectKeywords(grammar);
    
    const fileNode = new CompositeGeneratorNode();
    fileNode.children.push(
        new TextNode("/* eslint-disable */"),
        new NewLineNode(),
        new TextNode("// @ts-nocheck"),
        new NewLineNode(),
        new TextNode('import { createToken, Lexer } from "chevrotain";'),
        new NewLineNode(),
        new TextNode('import { PartialDeep } from "type-fest";'),
        new NewLineNode(),
        new TextNode('import { AstNode, RootNode, RuleResult } from "../generator/ast-node";'),
        new NewLineNode(),
        new TextNode('import { LangiumParser } from "../parser/langium-parser";'),
        new NewLineNode(),
        new TextNode('import { ' + grammar.Name + 'GrammarAccess } from "./grammar-access";'),
        new NewLineNode(),
    );

    fileNode.children.push(new TextNode("import {"));
    grammar.rules?.filter(e => e.kind == "ParserRule").map(e => e as ParserRule).forEach(e => {
        fileNode.children.push(new TextNode(" " + e.Name + ","));
    });
    fileNode.children.push(new TextNode(' } from "./ast";'), new NewLineNode(), new NewLineNode());

    let tokens: { name: string, length: number, node: CompositeGeneratorNode }[] = [];

    keywords.forEach(e => {
        tokens.push(buildKeywordToken(e));
    });

    tokens = tokens.sort((a, b) => b.length - a.length);

    grammar.rules?.filter(e => e.kind == "TerminalRule").map(e => e as TerminalRule).forEach(e => {
        tokens.push(buildTerminalToken(e));
    });

    tokens.forEach(e => {
        fileNode.children.push(e.node, new NewLineNode());
    });

    fileNode.children.push(new NewLineNode());

    keywords.forEach(e => {
        const token = buildKeywordToken(e);
        fileNode.children.push(
            new TextNode(token.name),
            new TextNode('.LABEL = "'),
            new TextNode("'"),
            new TextNode(e.substring(1, e.length - 1)),
            new TextNode("'\";"),
            new NewLineNode()
        );
    })

    const tokenListNode = new CompositeGeneratorNode();
    tokenListNode.children.push(
        new TextNode("const tokens = ["), 
        new TextNode(tokens.map(e => e.name).join(", ")), 
        new TextNode("];"),
        new NewLineNode()
    );

    fileNode.children.push(tokenListNode, new NewLineNode());
    fileNode.children.push(new TextNode("const lexer = new Lexer(tokens);"), new NewLineNode());

    fileNode.children.push(buildParser(grammar), new NewLineNode(), new NewLineNode());

    fileNode.children.push(new TextNode("let parser: Parser | undefined;"), new NewLineNode(), new NewLineNode());

    fileNode.children.push(buildParseFunction(grammar));
    return process(fileNode);
}

function buildParseFunction(grammar: Grammar): CompositeGeneratorNode {
    const firstRule = grammar.rules?.find(e => e.kind == "ParserRule") as ParserRule;
    const parseFunction = new CompositeGeneratorNode();
    parseFunction.children.push(
        new TextNode("export function parse(grammarAccess: " + grammar.Name + "GrammarAccess, text: string) {"), new NewLineNode());
    const parseBody = new IndentNode("    ");
    parseBody.children.push(
        "if (!parser) {", new NewLineNode(),
        "    parser = new Parser(grammarAccess);" , new NewLineNode(), "}", new NewLineNode(),
        new TextNode("const lexResult = lexer.tokenize(text);"), new NewLineNode(),
        new TextNode("parser.input = lexResult.tokens;"), new NewLineNode(),
        new TextNode("const ast = parser."), new TextNode(firstRule.Name), new TextNode("();"), new NewLineNode(),
        "(ast[AstNode.node] as RootNode).setText(text);", new NewLineNode(),
        new TextNode("return {"), new NewLineNode()
    );

    const resultObj = new IndentNode("    ");
    resultObj.children.push(
        new TextNode("ast,"), new NewLineNode(),
        new TextNode("lexErrors: lexResult.errors,"), new NewLineNode(),
        new TextNode("parseErrors: parser.errors"), new NewLineNode()
    );

    parseBody.children.push(resultObj, new TextNode("}"), new NewLineNode());
    parseFunction.children.push(parseBody, new TextNode("}"), new NewLineNode());
    return parseFunction;
}

function buildParser(grammar: Grammar): CompositeGeneratorNode {
    const parserNode = new CompositeGeneratorNode();

    parserNode.children.push("export class Parser extends LangiumParser {", new NewLineNode());

    const classBody = new IndentNode("    ");
    classBody.children.push("grammarAccess: " + grammar.Name + "GrammarAccess;", new NewLineNode());
    classBody.children.push("constructor(grammarAccess: " + grammar.Name + "GrammarAccess) {", new NewLineNode());

    const constructorBody = new IndentNode("    ");
    constructorBody.children.push(
        new TextNode('super(tokens);'), 
        new NewLineNode(),
        new TextNode("this.grammarAccess = grammarAccess;"),
        new NewLineNode(),
        new TextNode("this.performSelfAnalysis();"),
        new NewLineNode()
    );

    classBody.children.push(
        constructorBody,
        new TextNode("}"), 
        new NewLineNode(), 
        new NewLineNode()
    )

    let first = true;
    grammar.rules?.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(e => {
        const ctx: RuleContext = {
            name: e.Name,
            consume: 1,
            option: 1,
            subrule: 1,
            many: 1,
            or: 1,
            featureMap: findAllFeatures(e).byFeature
        };
        classBody.children.push(buildRule(ctx, e, first));
        first = false;
    });

    parserNode.children.push(classBody, new NewLineNode(), new TextNode("}"));

    return parserNode;
}

type RuleAlternative = {
    rule?: ParserRule,
    index?: number,
    group: UnorderedGroup
}

function collectRuleAlternatives(rule: ParserRule): RuleAlternative[] {
    const alts: RuleAlternative[] = [];
    if (rule.Alternatives.kind === "Alternatives") {
        rule.Alternatives.Elements.forEach((e, i) => {
            const group = e;
            alts.push({ rule, index: i, group });
        });
    } else {
        alts.push({ rule, index: 0, group: rule.Alternatives });
    }
    
    return alts;
}

function buildRule(ctx: RuleContext, rule: ParserRule, first: boolean): CompositeGeneratorNode {
    const ruleNode = new CompositeGeneratorNode();
    const alternatives = collectRuleAlternatives(rule);
    ruleNode.children.push(
        new TextNode(first ? "public " : "private "), 
        new TextNode(rule.Name)
    );

    ruleNode.children.push(
        new TextNode(' = this.RULE("'),
        new TextNode(rule.Name),
        new TextNode('", () => {'),
        new NewLineNode()
    )

    const ruleContent = new IndentNode(4);
    ruleNode.children.push(ruleContent);
    ruleContent.children.push(buildAlternatives(ctx, true, alternatives));
    ruleContent.children.push(buildRuleReturnStatement(rule, first));

    ruleNode.children.push(
        new TextNode("})"), 
        new NewLineNode(), 
        new NewLineNode()
    )
    

    return ruleNode;
}

function buildRuleReturnStatement(rule: ParserRule, first: boolean) : CompositeGeneratorNode {
    const node = new CompositeGeneratorNode();
    node.children.push("return this.construct<" + rule.Name + ">('", rule.Name, "'");
    if (first) {
        node.children.push(", true");
    }
    node.children.push(");", new NewLineNode());
    return node;
}

function buildAlternatives(ctx: RuleContext, root: boolean, alternatives: RuleAlternative[]): CompositeGeneratorNode {
    const altNode = new CompositeGeneratorNode();

    if (alternatives.length > 1) {
        altNode.children.push(new TextNode("this.or(" + ctx.or++ + ", ["), new NewLineNode());
        const altIndentNode = new IndentNode("    ");
        altNode.children.push(altIndentNode);

        alternatives.forEach(e => {
            altIndentNode.children.push(new TextNode("{"), new NewLineNode());
            const chevAltNode = new IndentNode("    ");
            chevAltNode.children.push(new TextNode("ALT: () => {"), new NewLineNode());
            const indGroup = new IndentNode("    ");
            indGroup.children.push(buildUnorderedGroup(ctx, root, e.group));
            chevAltNode.children.push(indGroup);
            chevAltNode.children.push(new TextNode("}"), new NewLineNode());
            altIndentNode.children.push(chevAltNode, new TextNode("},"), new NewLineNode());
        });

        altNode.children.push(new TextNode("])"), new NewLineNode());
    } else {
        altNode.children.push(buildUnorderedGroup(ctx, false, alternatives[0].group));
    }
    return altNode;
}

function buildUnorderedGroup(ctx: RuleContext, root: boolean, group: UnorderedGroup): CompositeGeneratorNode {
    if (group.kind === "Group") {
        return buildGroup(ctx, root, group);
    } else {
        throw new Error("Unordered groups are not supported (yet)");
    }
}

function buildGroup(ctx: RuleContext, root: boolean, group: Group): CompositeGeneratorNode {
    const groupNode = new CompositeGeneratorNode();

    group.Elements.forEach(e => {
        if (e.kind === "Action") {
            groupNode.children.push(buildAction(ctx, e), new NewLineNode());
        } else if (e.kind === "Assignment") {
            const assignmentNode = buildAssignment(ctx, e);
            groupNode.children.push(wrap(ctx, assignmentNode, e.Cardinality), new NewLineNode());
        } else {
            const terminalNode = buildTerminal(ctx, e);
            groupNode.children.push(wrap(ctx, terminalNode, e.Cardinality), new NewLineNode());
        }
    });

    return groupNode;
}

function buildAction(ctx: RuleContext, action: Action): GeneratorNode {
    return "this.executeAction(" + getGrammarAccess(ctx, action) + ")";
}

function buildTerminal(ctx: RuleContext, terminal: AbstractTerminal): GeneratorNode {
    switch (terminal.kind) {
        case "Keyword": {
            return buildKeyword(ctx, terminal);
        }
        case "RuleCall": {
            return buildRuleCall(ctx, terminal);
        }
        case "UnorderedGroup":
        case "Group":
        case "Alternatives": {
            return buildParenthesizedGroup(ctx, terminal);
        }
    }
    return "";
}

function buildAssignment(ctx: RuleContext, assignment: Assignment): GeneratorNode {
    return buildAssignableElement(ctx, assignment.Terminal, assignment)
}

function buildAssignableElement(ctx: RuleContext, v: AssignableTerminal, assignment?: Assignment): GeneratorNode {
    switch (v.kind) {
        case "Keyword": {
            return buildKeyword(ctx, v, assignment);
        } case "CrossReference": {
            return new TextNode("this.consumeLeaf(" + ctx.consume++ + ", ID, " + getGrammarAccess(ctx, assignment ?? v) + ")");
        } case "RuleCall": {
            return buildRuleCall(ctx, v, assignment);
        } case "AssignableAlternatives": {
            return buildParenthesizedElement(ctx, v, assignment);
        }
    }
}

function buildParenthesizedElement(ctx: RuleContext, element: ParenthesizedAssignableElement, assignment?: Assignment): GeneratorNode {
    if (element.Elements.length == 1) {
        return buildAssignableElement(ctx, element.Elements[0], assignment);
    } else {
        const wrapper = new CompositeGeneratorNode();
        wrapper.children.push(new TextNode("this.or(" + ctx.or++ + ", ["), new NewLineNode());

        element.Elements.forEach(e => {
            wrapper.children.push(new TextNode("{ ALT: () => {"), new NewLineNode());
            wrapper.children.push(buildAssignableElement(ctx, e, assignment), new NewLineNode());
            wrapper.children.push(new TextNode("}},"), new NewLineNode());
        });

        wrapper.children.push(new TextNode("])"));

        return wrapper;
    }
}

function wrap<T extends GeneratorNode>(ctx: RuleContext, node: T, cardinality: string | undefined): T | CompositeGeneratorNode {
    if (!cardinality) {
        return node;
    } else {
        const wrapper = new CompositeGeneratorNode();
        if (cardinality == "*" || cardinality == "+") {
            wrapper.children.push(new TextNode("this.many(" + ctx.many++ + ", () => {"), new NewLineNode());
        } else if (cardinality == "?") {
            wrapper.children.push(new TextNode("this.option(" + ctx.option++ + ", () => {"), new NewLineNode());
        }

        const indent = new IndentNode("    ");
        indent.children.push(node);
        wrapper.children.push(indent, new TextNode("})"));

        return wrapper;
    }
}

function buildParenthesizedGroup(ctx: RuleContext, group: ParenthesizedElement): CompositeGeneratorNode {
    const ruleAlternatives: RuleAlternative[] = [];
    if (group.kind === "Alternatives") {
        ruleAlternatives.push(...group.Elements.map(e => <RuleAlternative>{ group: e }));
    } else {
        ruleAlternatives.push(<RuleAlternative>{ group });
    }
    return buildAlternatives(ctx, false, ruleAlternatives);
}

function buildRuleCall(ctx: RuleContext, ruleCall: RuleCall, assignment?: Assignment): string {
    if (ruleCall.Rule.kind == "ParserRule") {
        if (assignment) {
            return "this.subruleLeaf(" + ctx.subrule++ + ", this." + ruleCall.Rule.Name + ", " + getGrammarAccess(ctx, assignment) + ")";
        } else {
            return "this.unassignedSubrule(" + ctx.subrule++ + ", this." + ruleCall.Rule.Name + ", " + getGrammarAccess(ctx, ruleCall) + ")";
        }
    } else if (ruleCall.Rule.kind == "TerminalRule") {
        return "this.consumeLeaf(" + ctx.consume++  + ", " + ruleCall.Rule.Name + ", " + getGrammarAccess(ctx, assignment ?? ruleCall) + ")";
    }
    
    return "";
}

function buildKeyword(ctx: RuleContext, keyword: Keyword, assignment?: Assignment): TextNode {
    const validName = replaceTokens(keyword.Value) + "Keyword";
    const node = new TextNode("this.consumeLeaf(" + ctx.consume++ + ", " + validName + ", " + getGrammarAccess(ctx, assignment ?? keyword) + ")");
    return node;
}

function getGrammarAccess(ctx: RuleContext, feature: Feature): string {
    return "this.grammarAccess." + ctx.name + "." + ctx.featureMap.get(feature);
}

function buildTerminalToken(terminal: TerminalRule): { name: string, length: number, node: CompositeGeneratorNode } {
    const terminalNode = new CompositeGeneratorNode();
    terminalNode.children.push(
        new TextNode("const "),
        new TextNode(terminal.Name),
        new TextNode(" = createToken({ name : '"),
        new TextNode(terminal.Name),
        new TextNode("', pattern: "),
        new TextNode(terminal.Regex));

    if (terminal.Name === "WS") {
        terminalNode.children.push(new TextNode(", group: Lexer.SKIPPED"));
    }

    terminalNode.children.push(
        new TextNode(" });"));
    
    return { name: terminal.Name, length: terminal.Regex.length, node: terminalNode };
}

function buildKeywordToken(keyword: string): { name: string, length: number, node: CompositeGeneratorNode } {
    const keywordNode = new CompositeGeneratorNode();
    const validName = replaceTokens(keyword) + "Keyword";
    keywordNode.children.push(
        new TextNode("const "), 
        new TextNode(validName),
        new TextNode(" = createToken({ name: '"),
        new TextNode(validName),
        new TextNode("', pattern: /"),
        new TextNode(escapeRegExp(keyword.substring(1, keyword.length - 1))),
        new TextNode("/ });"));
    return { name: validName, length: keyword.length, node: keywordNode };
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectKeywords(grammar: Grammar): string[] {
    const keywords = new Set<string>();

    grammar.rules?.filter(e => e.kind == "ParserRule").map(e => e as ParserRule).forEach(r => {
        collectRuleKeywords(r, keywords);
    });

    return Array.from(keywords);
}

function collectRuleKeywords(rule: ParserRule, keywords: Set<string>) {
    collectAlternativeKeywords(rule.Alternatives, keywords);
}

function collectAlternativeKeywords(alternatives: Alternatives, keywords: Set<string>) {
    if (alternatives.kind === "Alternatives") {
        alternatives.Elements.forEach(e => {
            collectUnorderedGroupKeywords(e, keywords);
        });
    } else {
        collectUnorderedGroupKeywords(alternatives, keywords);
    }
}

function collectUnorderedGroupKeywords(group: UnorderedGroup, keywords: Set<string>) {
    if (group.kind === "UnorderedGroup") {
        group.Elements.forEach(g => {
            collectGroupKeywords(g, keywords);
        });
    } else {
        collectGroupKeywords(group, keywords);
    }
}

function collectAssignableTerminal(terminal: AssignableTerminal, keywords: Set<string>) {
    switch (terminal.kind) {
        case "Keyword": {
            keywords.add(terminal.Value);
            break;
        }
        case "AssignableAlternatives": {
            terminal.Elements.forEach(e => {
                collectAssignableTerminal(e, keywords);
            })
        }
    }
}

function collectGroupKeywords(group: Group, keywords: Set<string>) {
    group.Elements.forEach(element => {

        if (element.kind == "Assignment") {
            const assignment = element;
                const terminal = assignment.Terminal;
                collectAssignableTerminal(terminal, keywords);
        } else if (element.kind !== "Action") {
                switch (element.kind) {
                    case "Keyword": {
                        keywords.add(element.Value);
                        break;
                    }
                    case "Alternatives":
                    case "UnorderedGroup":
                    case "Group": {
                        collectAlternativeKeywords(element, keywords);
                        break;
                    }
                    case "PredicatedGroup": {
                        element.Elements.forEach(e => {
                            collectAlternativeKeywords(e, keywords);
                        });
                        break;
                    }
                    case "PredicatedKeyword": {
                        keywords.add(element.Value);
                    }
                }
        }
    });
}