/* eslint-disable */
import { AbstractTerminal, Alternatives, AssignableTerminal, Assignment, Grammar, Group, Keyword, ParenthesizedAssignableElement, ParenthesizedElement, ParserRule, RuleCall, TerminalRule, UnorderedGroup } from "../gen/ast";
import { CompositeGeneratorNode, IGeneratorNode, IndentNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { replaceTokens } from "./token-replacer";
import { collectRule as collectRuleFields } from "./utils";

type RuleContext = {
    option: number,
    consume: number,
    subrule: number,
    many: number,
    or: number
}

export function generateParser(grammar: Grammar): string {
    const keywords = collectKeywords(grammar);

    const fileNode = new CompositeGeneratorNode();
    fileNode.children.push(
        new TextNode("/* eslint-disable */"),
        new NewLineNode(),
        new TextNode("// @ts-nocheck"),
        new NewLineNode(),
        new TextNode('import { createToken, Lexer, EmbeddedActionsParser } from "chevrotain";'),
        new NewLineNode(),
        new TextNode('import { PartialDeep } from "type-fest";'),
        new NewLineNode(),
        new TextNode('import { RuleResult } from "../generator/ast-node";'),
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

    fileNode.children.push(new TextNode("const parser = new Parser();"), new NewLineNode(), new NewLineNode());

    fileNode.children.push(buildParseFunction(grammar));
    return process(fileNode);
}

function buildParseFunction(grammar: Grammar): CompositeGeneratorNode {
    const firstRule = grammar.rules?.find(e => e.kind == "ParserRule") as ParserRule;
    const parseFunction = new CompositeGeneratorNode();
    parseFunction.children.push(
        new TextNode("export function parse(text: string) {"), new NewLineNode());
    const parseBody = new IndentNode("    ");
    parseBody.children.push(
        new TextNode("const lexResult = lexer.tokenize(text);"), new NewLineNode(),
        new TextNode("parser.input = lexResult.tokens;"), new NewLineNode(),
        new TextNode("const ast = parser."), new TextNode(firstRule.Name), new TextNode("();"), new NewLineNode(),
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

    parserNode.children.push(new TextNode("export class Parser extends EmbeddedActionsParser {"), new NewLineNode());

    const classBody = new IndentNode("    ");
    classBody.children.push(new TextNode("constructor() {"), new NewLineNode());

    const constructorBody = new IndentNode("    ");
    constructorBody.children.push(
        new TextNode('super(tokens, { recoveryEnabled: true });'),
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
            consume: 1,
            option: 1,
            subrule: 1,
            many: 1,
            or: 1
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
    group: UnorderedGroup,
    subrule: boolean
}

function collectRuleAlternatives(rule: ParserRule): RuleAlternative[] {
    const alts: RuleAlternative[] = [];
    rule.Alternatives.Elements.forEach((e, i) => {
        const group = e;
        const subrule = isSubrule(e);
        alts.push({ rule, index: i, group, subrule });
    });
    return alts;
}

function isSubrule(group: UnorderedGroup): boolean {
    if (group.Elements.length == 1) {
        const g = group.Elements[0];
        if (g.Elements.length == 1) {
            const e = g.Elements[0];
            if (e.kind == "AbstractTokenWithCardinality") {
                return e.Terminal && e.Terminal.kind == "RuleCall";
            }
        }
    }
    return false;
}

function buildRule(ctx: RuleContext, rule: ParserRule, first: boolean): CompositeGeneratorNode {
    const ruleNode = new CompositeGeneratorNode();
    const { fields } = collectRuleFields(rule);
    const alternatives = collectRuleAlternatives(rule);
    ruleNode.children.push(
        new TextNode(first ? "public " : "private "), 
        new TextNode(rule.Name)
    );

    if (fields.length > 0) {
        ruleNode.children.push(new TextNode(': RuleResult<' + rule.Name + '>'));
    }

    ruleNode.children.push(
        new TextNode(' = this.RULE("'),
        new TextNode(rule.Name),
        new TextNode('", () => {'),
        new NewLineNode()
    )

    if (alternatives.length < 2) {
        ruleNode.children.push(buildPropertyInitializers(rule));
    }
    ruleNode.children.push(buildAlternatives(ctx, true, alternatives));
    if (alternatives.length < 2) {
        ruleNode.children.push(buildRuleReturnStatement(rule));
    }

    ruleNode.children.push(
        new TextNode("})"), 
        new NewLineNode(), 
        new NewLineNode()
    )

    if (alternatives.length > 1) {
        alternatives.filter(e => !e.subrule).forEach(e => {
            ruleNode.children.push(buildRuleAlternative(ctx, e));
        });
    } 
    

    return ruleNode;
}

function buildRuleAlternative(ctx: RuleContext, alt: RuleAlternative): CompositeGeneratorNode {
    const ruleNode = new CompositeGeneratorNode();
    const rule = alt.rule!;

    ruleNode.children.push(new TextNode("private " + rule.Name + "_" + alt.index + ": RuleResult<" + rule.Name + '> = this.RULE("' + rule.Name + "_" + alt.index + '", () => {'), new NewLineNode());

    ruleNode.children.push(
        buildPropertyInitializers(rule),
        buildUnorderedGroup(ctx, true, alt.group),
        buildRuleReturnStatement(rule),
        new TextNode("})"), 
        new NewLineNode(), 
        new NewLineNode()
    );

    return ruleNode;
}

function buildPropertyInitializers(rule: ParserRule): CompositeGeneratorNode {
    const node = new IndentNode("    ");

    const { fields } = collectRuleFields(rule);

    fields.forEach(e => {
        let prefix = "";
        let suffix = "";
        if (e.array) {
            prefix = "(";
            suffix = ")[] = []";
        } else {
            suffix = " | undefined";
        }
        node.children.push(new TextNode("let " + e.name + ": " + prefix + e.type.map(e => partialType(e)).join(" | ") + suffix), new NewLineNode());
    })

    node.children.push(new TextNode("let refs = new Map<string, string>()"), new NewLineNode());

    return node;
}

function partialType(type: string): string {
    if (type !== "string" && type != "boolean" && type != "number") {
        return "PartialDeep<" + type + ">";
    } else{
        return type;
    }
}

function buildRuleReturnStatement(rule: ParserRule) : CompositeGeneratorNode {
    const node = new IndentNode("    ");

    const { fields } = collectRuleFields(rule);

    if (fields.length > 0) {
        node.children.push(new TextNode("return <PartialDeep<" + rule.Name + ">> {"), new NewLineNode());
        
        const indent = new IndentNode("    ");
        indent.children.push(new TextNode('kind: "' + rule.Name + '",'), new NewLineNode());
        indent.children.push(new TextNode("'.references': refs,"), new NewLineNode());
        fields.forEach(e => {
            indent.children.push(new TextNode(e.name + ","), new NewLineNode());
        });

        node.children.push(indent, new TextNode("}"), new NewLineNode());
    }

    return node;
}

function buildAlternatives(ctx: RuleContext, root: boolean, alternatives: RuleAlternative[]): CompositeGeneratorNode {
    const altNode = new IndentNode("    ");

    if (alternatives.length > 1) {
        if (root) {
            altNode.children.push(new TextNode("return "));
        }
        altNode.children.push(new TextNode("this.or(" + ctx.or++ + ", ["), new NewLineNode());
        const altIndentNode = new IndentNode("    ");
        altNode.children.push(altIndentNode);

        alternatives.forEach(e => {
            altIndentNode.children.push(new TextNode("{"), new NewLineNode());
            const chevAltNode = new IndentNode("    ");
            chevAltNode.children.push(new TextNode("ALT: () => {"), new NewLineNode());
            const indGroup = new IndentNode("    ");
            if (!e.subrule) {
                indGroup.children.push(new TextNode("return this.subrule(" + ctx.subrule++ + ", this." + e.rule!.Name + "_" + e.index! + ")"));
            } else {
                indGroup.children.push(buildUnorderedGroup(ctx, root, e.group));
            }
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
    if (group.Elements.length > 1) {
        throw new Error("Unordered groups are not supported (yet)");
    }
    return buildGroup(ctx, root, group.Elements[0]);
}

function buildGroup(ctx: RuleContext, root: boolean, group: Group): CompositeGeneratorNode {
    const groupNode = new CompositeGeneratorNode();

    group.Elements.forEach(e => {
        switch (e.kind) {
            case "AbstractTokenWithCardinality": {
                if (e.Assignment) {
                    const assignmentNode = buildAssignment(ctx, e.Assignment);
                    groupNode.children.push(wrap(ctx, assignmentNode, e.Cardinality), new NewLineNode());
                }
                if (e.Terminal) {
                    if (root && e.Terminal.kind == "RuleCall") {
                        groupNode.children.push(new TextNode("return "));
                    }
                    const terminalNode = buildTerminal(ctx, e.Terminal);
                    groupNode.children.push(wrap(ctx, terminalNode, e.Cardinality), new NewLineNode());
                }
            }
            case "Action": {
                // todo: build action
            }
        }
    });

    return groupNode;
}

function buildTerminal(ctx: RuleContext, terminal: AbstractTerminal): IGeneratorNode {
    switch (terminal.kind) {
        case "Keyword": {
            return buildKeyword(ctx, terminal);
        }
        case "RuleCall": {
            return buildRuleCall(ctx, terminal);
        }
        case "ParenthesizedElement": {
            return buildParenthesizedGroup(ctx, terminal);
        }
    }
    return {};
}

function buildAssignment(ctx: RuleContext, assignment: Assignment): CompositeGeneratorNode {
    const assignNode = new CompositeGeneratorNode();
    const crossRef = assignment.Terminal.kind == "CrossReference";
    let prefix = ""
    let suffix = ""

    if (assignment.Operator == "=") {
        if (crossRef) {
            prefix = 'refs.set("' + fixFeature(assignment.Feature) + '", ';
            suffix = ")";
        } else {
            prefix = fixFeature(assignment.Feature) + " = ";
        }
    } else if (assignment.Operator == "?=") {
        prefix = fixFeature(assignment.Feature) + " = true;";
    } else if (assignment.Operator == "+=") {
        if (crossRef) {
            // ignore this for now
        } else {
            prefix = fixFeature(assignment.Feature) + ".push(";
            suffix = ")";
        }
    }

    assignNode.children.push(new TextNode(prefix));
    assignNode.children.push(buildAssignableElement(ctx, assignment.Terminal));
    assignNode.children.push(new TextNode(suffix));

    return assignNode;
}

function buildAssignableElement(ctx: RuleContext, v: AssignableTerminal): IGeneratorNode {
    switch (v.kind) {
        case "Keyword": {
            return buildKeyword(ctx, v);
        } case "CrossReference": {
            return new TextNode("this.consume(" + ctx.consume++ + ", ID).image");
        } case "RuleCall": {
            return buildRuleCall(ctx, v);
        } case "ParenthesizedAssignableElement": {
            return buildParenthesizedElement(ctx, v);
        }
    }
}

function buildParenthesizedElement(ctx: RuleContext, element: ParenthesizedAssignableElement): IGeneratorNode {
    if (element.Alternatives.Elements.length == 1) {
        return buildAssignableElement(ctx, element.Alternatives.Elements[0]);
    } else {
        const wrapper = new CompositeGeneratorNode();
        wrapper.children.push(new TextNode("this.or(" + ctx.or++ + ", ["), new NewLineNode());

        element.Alternatives.Elements.forEach(e => {
            wrapper.children.push(new TextNode("{ ALT: () => {"), new NewLineNode());
            wrapper.children.push(new TextNode("return "), buildAssignableElement(ctx, e), new NewLineNode());
            wrapper.children.push(new TextNode("}},"), new NewLineNode());
        });

        wrapper.children.push(new TextNode("])"));

        return wrapper;
    }
}

function wrap<T extends IGeneratorNode>(ctx: RuleContext, node: T, cardinality: string | undefined): T | CompositeGeneratorNode {
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
    return buildAlternatives(ctx, false, group.Alternatives.Elements.map(e => <RuleAlternative>{ group: e, subrule: true }));
}

function buildRuleCall(ctx: RuleContext, ruleCall: RuleCall): TextNode {
    if (ruleCall.Rule.kind == "ParserRule") {
        return new TextNode("this.subrule(" + ctx.subrule++ + ", this." + ruleCall.Rule.Name + ")");
    } else if (ruleCall.Rule.kind == "TerminalRule") {
        return new TextNode("this.consume(" + ctx.consume++ + ", " + ruleCall.Rule.Name + ").image");
    }
    
    return new TextNode("");
}

function buildKeyword(ctx: RuleContext, keyword: Keyword): TextNode {
    const validName = replaceTokens(keyword.Value) + "Keyword";
    const node = new TextNode("this.consume(" + ctx.consume++ + ", " + validName + ").image");
    return node;
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
    alternatives.Elements.forEach(e => {
        e.Elements.forEach(g => {
            collectGroupKeywords(g, keywords);
        });
    });
}

function collectAssignableTerminal(terminal: AssignableTerminal, keywords: Set<string>) {
    switch (terminal.kind) {
        case "Keyword": {
            keywords.add(terminal.Value);
            break;
        }
        case "ParenthesizedAssignableElement": {
            terminal.Alternatives.Elements.forEach(e => {
                collectAssignableTerminal(e, keywords);
            })
        }
    }
}

function collectGroupKeywords(group: Group, keywords: Set<string>) {
    group.Elements.forEach(element => {

        if (element.kind == "AbstractTokenWithCardinality") {
            if (element.Assignment) {
                const assignment = element.Assignment;
                const terminal = assignment.Terminal;
                collectAssignableTerminal(terminal, keywords);
            }
            if (element.Terminal) {
                const terminal = element.Terminal;
                switch (terminal.kind) {
                    case "Keyword": {
                        keywords.add(terminal.Value);
                        break;
                    }
                    case "ParenthesizedElement": {
                        collectAlternativeKeywords(terminal.Alternatives, keywords);
                        break;
                    }
                    case "PredicatedGroup": {
                        terminal.Elements.forEach(e => {
                            collectAlternativeKeywords(e, keywords);
                        });
                        break;
                    }
                    case "PredicatedKeyword": {
                        keywords.add(terminal.Value);
                    }
                }
            }
        }
    });
}

function fixFeature(feature: string): string {
    if (feature.startsWith('^')) {
        return feature.substring(1);
    }
    return feature;
}