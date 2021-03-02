import { Alternative, Assignment, Cardinality, CrossReference, Grammar, Group, Keyword, ParenthesizedAssignableElement, ParenthesizedGroup, Rule, RuleCall, Terminal } from "../bootstrap/ast";
import { CompositeGeneratorNode, IGeneratorNode, IndentNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { replaceTokens } from "./token-replacer";
import { collectRule } from "./utils";

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
        new TextNode('import { createToken, Lexer, EmbeddedActionsParser } from "chevrotain";'),
        new NewLineNode(),
        new TextNode('import { PartialDeep } from "type-fest";'),
        new NewLineNode(),
        new TextNode('import { RuleResult } from "../generator/ast-node";'),
        new NewLineNode(),
    );

    fileNode.children.push(new TextNode("import {"));
    grammar.rules?.filter(e => e.kind == "rule").map(e => e as Rule).forEach(e => {
        fileNode.children.push(new TextNode(" " + e.name! + ","));
    });
    fileNode.children.push(new TextNode(' } from "./ast";'), new NewLineNode(), new NewLineNode());

    let tokens: { name: string, length: number, node: CompositeGeneratorNode }[] = [];

    keywords.forEach(e => {
        tokens.push(buildKeywordToken(e));
    });

    tokens = tokens.sort((a, b) => b.length - a.length);

    grammar.rules?.filter(e => e.kind == "terminal").map(e => e as Terminal).forEach(e => {
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
            new TextNode(e),
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
    const firstRule = grammar.rules?.find(e => e.kind == "rule") as Rule;
    const parseFunction = new CompositeGeneratorNode();
    parseFunction.children.push(
        new TextNode("export function parse(text: string) {"), new NewLineNode());
    const parseBody = new IndentNode("    ");
    parseBody.children.push(
        new TextNode("const lexResult = lexer.tokenize(text);"), new NewLineNode(),
        new TextNode("parser.input = lexResult.tokens;"), new NewLineNode(),
        new TextNode("const ast = parser."), new TextNode(firstRule.name!), new TextNode("();"), new NewLineNode(),
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
    grammar.rules?.filter(e => e.kind === "rule").map(e => e as Rule).forEach(e => {
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

function buildRule(ctx: RuleContext, rule: Rule, first: boolean): CompositeGeneratorNode {
    const ruleNode = new CompositeGeneratorNode();
    const { fields } = collectRule(rule);
    ruleNode.children.push(
        new TextNode(first ? "public " : "private "), 
        new TextNode(rule.name)
    );

    if (fields.length > 0) {
        ruleNode.children.push(new TextNode(': RuleResult<' + rule.name + '>'));
    }

    ruleNode.children.push(
        new TextNode(' = this.RULE("'),
        new TextNode(rule.name),
        new TextNode('", () => {'),
        new NewLineNode()
    )

    ruleNode.children.push(
        buildPropertyInitializers(rule),
        buildAlternatives(ctx, true, rule.alternatives!),
        buildRuleReturnStatement(rule),
        new TextNode("})"), 
        new NewLineNode(), 
        new NewLineNode()
    );

    return ruleNode;
}

function buildPropertyInitializers(rule: Rule): CompositeGeneratorNode {
    const node = new IndentNode("    ");

    const { fields } = collectRule(rule);

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

function buildRuleReturnStatement(rule: Rule) : CompositeGeneratorNode {
    const node = new IndentNode("    ");

    const { fields } = collectRule(rule);

    if (fields.length > 0) {
        node.children.push(new TextNode("return <PartialDeep<" + rule.name! + ">> {"), new NewLineNode());
        
        const indent = new IndentNode("    ");
        indent.children.push(new TextNode('kind: "' + rule.name! + '",'), new NewLineNode());
        indent.children.push(new TextNode("'.references': refs,"), new NewLineNode());
        fields.forEach(e => {
            indent.children.push(new TextNode(e.name + ","), new NewLineNode());
        });

        node.children.push(indent, new TextNode("}"), new NewLineNode());
    }

    return node;
}

function buildAlternatives(ctx: RuleContext, root: boolean, alternatives: Alternative[]): CompositeGeneratorNode {
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
            indGroup.children.push(buildGroup(ctx, true, e.group!));
            chevAltNode.children.push(indGroup);
            chevAltNode.children.push(new TextNode("}"), new NewLineNode());
            altIndentNode.children.push(chevAltNode, new TextNode("},"), new NewLineNode());
        });

        altNode.children.push(new TextNode("])"), new NewLineNode());
    } else {
        altNode.children.push(buildGroup(ctx, false, alternatives[0].group!));
    }
    return altNode;
}

function buildGroup(ctx: RuleContext, root: boolean, group: Group): CompositeGeneratorNode {
    const groupNode = new CompositeGeneratorNode();

    group.items?.forEach(e => {
        switch (e.kind) {
            case "rule-call": {
                if (root) {
                    groupNode.children.push(new TextNode("return "));
                }
                groupNode.children.push(buildRuleCall(ctx, e), new NewLineNode());
                break;
            }
            case "parenthesized-group": {
                groupNode.children.push(buildParenthesizedGroup(ctx, e), new NewLineNode());
                break;
            }
            case "keyword": {
                groupNode.children.push(buildKeyword(ctx, e), new NewLineNode());  
                break;              
            }
            case "assignment": {
                groupNode.children.push(buildAssignment(ctx, e), new NewLineNode());
                break;
            }
        }
    });

    return groupNode;
}

function buildAssignment(ctx: RuleContext, assignment: Assignment): CompositeGeneratorNode {
    const assignNode = new CompositeGeneratorNode();
    const crossRef = assignment.value!.kind == "cross-reference";
    let prefix = ""
    let suffix = ""

    if (assignment.type == "=") {
        if (crossRef) {
            prefix = 'refs.set("' + assignment.name! + '", ';
            suffix = ")";
        } else {
            prefix = assignment.name! + " = ";
        }
    } else if (assignment.type == "?=") {
        prefix = assignment.name! + " = true;";
    } else if (assignment.type == "+=") {
        if (crossRef) {
            // ignore this for now
        } else {
            prefix = assignment.name! + ".push(";
            suffix = ")";
        }
    }

    assignNode.children.push(new TextNode(prefix));
    assignNode.children.push(buildAssignableElement(ctx, assignment.value!));
    assignNode.children.push(new TextNode(suffix));

    return wrap(ctx, assignNode, assignment.cardinality);
}

function buildAssignableElement(ctx: RuleContext, v: Keyword | RuleCall | ParenthesizedAssignableElement | CrossReference): IGeneratorNode {
    switch (v.kind) {
        case "keyword": {
            return buildKeyword(ctx, v);
        } case "cross-reference": {
            return new TextNode("this.consume(" + ctx.consume++ + ", ID).image");
        } case "rule-call": {
            return buildRuleCall(ctx, v);
        } case "parenthesized-assignable-element": {
            return buildParenthesizedElement(ctx, v);
        }
    }
}

function buildParenthesizedElement(ctx: RuleContext, element: ParenthesizedAssignableElement): IGeneratorNode {
    if (element.items.length == 1) {
        return buildAssignableElement(ctx, element.items[0]);
    } else {
        const wrapper = new CompositeGeneratorNode();
        wrapper.children.push(new TextNode("this.or(" + ctx.or++ + ", ["), new NewLineNode());

        element.items.forEach(e => {
            wrapper.children.push(new TextNode("{ ALT: () => {"), new NewLineNode());
            wrapper.children.push(buildAssignableElement(ctx, e), new NewLineNode());
            wrapper.children.push(new TextNode("}},"), new NewLineNode());
        });

        wrapper.children.push(new TextNode("])"));

        return wrapper;
    }
}

function wrap<T extends IGeneratorNode>(ctx: RuleContext, node: T, cardinality: Cardinality | undefined): T | CompositeGeneratorNode {
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

function buildParenthesizedGroup(ctx: RuleContext, group: ParenthesizedGroup): CompositeGeneratorNode {
    return wrap(ctx, buildAlternatives(ctx, false, group.alternatives!), group.cardinality);
}

function buildRuleCall(ctx: RuleContext, ruleCall: RuleCall): TextNode {
    if (ruleCall.rule!.kind == "rule") {
        return new TextNode("this.subrule(" + ctx.subrule++ + ", this." + ruleCall.rule!.name! + ")");
    } else if (ruleCall.rule!.kind == "terminal") {
        return new TextNode("this.consume(" + ctx.consume++ + ", " + ruleCall.rule!.name! + ").image");
    }
    
    return new TextNode("");
}

function buildKeyword(ctx: RuleContext, keyword: Keyword): TextNode {
    const validName = replaceTokens(keyword.value!) + "Keyword";
    const node = new TextNode("this.consume(" + ctx.consume++ + ", " + validName + ").image");
    return node;
}

function buildTerminalToken(terminal: Terminal): { name: string, length: number, node: CompositeGeneratorNode } {
    const terminalNode = new CompositeGeneratorNode();
    terminalNode.children.push(
        new TextNode("const "),
        new TextNode(terminal.name),
        new TextNode(" = createToken({ name : '"),
        new TextNode(terminal.name),
        new TextNode("', pattern: "),
        new TextNode(terminal.regex));

    if (terminal.name === "WS") {
        terminalNode.children.push(new TextNode(", group: Lexer.SKIPPED"));
    }

    terminalNode.children.push(
        new TextNode(" });"));
    
    return { name: terminal.name!, length: terminal.regex!.length, node: terminalNode };
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
        new TextNode(escapeRegExp(keyword)),
        new TextNode("/ });"));
    return { name: validName, length: keyword.length, node: keywordNode };
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectKeywords(grammar: Grammar): string[] {
    const keywords = new Set<string>();

    grammar.rules?.filter(e => e.kind == "rule").map(e => e as Rule).forEach(r => {
        collectRuleKeywords(r, keywords);
    });

    return Array.from(keywords);
}

function collectRuleKeywords(rule: Rule, keywords: Set<string>) {
    rule.alternatives?.forEach(a => {
        collectAlternativeKeywords(a, keywords);
    });
}

function collectAlternativeKeywords(alternative: Alternative, keywords: Set<string>) {
    collectGroupKeywords(alternative.group!, keywords);
}

function collectGroupKeywords(group: Group, keywords: Set<string>) {
    group.items?.forEach(element => {

        if ("value" in element && element.value) {

            if (typeof(element.value) === "string") {
                keywords.add(element.value);
            } else if ("kind" in element.value) {
                collectValueKeywords(element.value, keywords);
            }
        } else if ("alternatives" in element) {
            element.alternatives?.forEach(a => {
                collectAlternativeKeywords(a, keywords);
            });
        }
    });
}

function collectValueKeywords(value: Keyword | ParenthesizedAssignableElement | RuleCall | CrossReference, keywords: Set<string>) {
    switch (value.kind) {
        case "keyword": {
            keywords.add(value.value!);
            break;
        } case "parenthesized-assignable-element": {
            value.items.forEach(e => {
                collectValueKeywords(e, keywords);
            })
        }
    }
}