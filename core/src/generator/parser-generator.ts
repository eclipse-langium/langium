import { Alternative, Grammar, Group, Rule, Terminal } from "../bootstrap/ast";
import { CompositeGeneratorNode, IndentNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { replaceTokens } from "./token-replacer";

export function generateParser(grammar: Grammar): string {
    const keywords = collectKeywords(grammar);

    const fileNode = new CompositeGeneratorNode();
    fileNode.children.push(
        new TextNode('import { createToken, Lexer, CstParser } from "chevrotain";'),
        new NewLineNode(),
        new NewLineNode()
    );

    const tokens: { name: string, node: CompositeGeneratorNode }[] = [];

    grammar.rules?.filter(e => e.kind == "terminal").map(e => e as Terminal).forEach(e => {
        tokens.push(buildTerminalToken(e));
    });

    keywords.forEach(e => {
        tokens.push(buildKeywordToken(e));
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

    parserNode.children.push(new TextNode("export class Parser extends CstParser {"), new NewLineNode());

    const classBody = new IndentNode("    ");
    classBody.children.push(new TextNode("constructor() {"), new NewLineNode());

    const constructorBody = new IndentNode("    ");
    constructorBody.children.push(
        new TextNode('super(tokens, { recoveryEnabled: true, nodeLocationTracking: "onlyOffset" });'),
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
        classBody.children.push(buildRule(e, first));
        first = false;
    });

    parserNode.children.push(classBody, new NewLineNode(), new TextNode("}"));

    return parserNode;
}

function buildRule(rule: Rule, first: boolean): CompositeGeneratorNode {
    const ruleNode = new CompositeGeneratorNode();
    ruleNode.children.push(
        new TextNode(first ? "public " : "private "), 
        new TextNode(rule.name!),
        new TextNode(' = this.RULE("'),
        new TextNode(rule.name),
        new TextNode('", () => {'),
        new NewLineNode()
    );

    const bodyNode = new IndentNode("    ");
    ruleNode.children.push(
        bodyNode, 
        new NewLineNode(), 
        new TextNode("});"), 
        new NewLineNode(), 
        new NewLineNode()
    );
    bodyNode.children.push();

    return ruleNode;
}

function buildTerminalToken(terminal: Terminal): { name: string, node: CompositeGeneratorNode } {
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
    
    return { name: terminal.name!, node: terminalNode };
}

function buildKeywordToken(keyword: string): { name: string, node: CompositeGeneratorNode } {
    const keywordNode = new CompositeGeneratorNode();
    const validName = replaceTokens(keyword);
    keywordNode.children.push(
        new TextNode("const "), 
        new TextNode(validName),
        new TextNode(" = createToken({ name: '"),
        new TextNode(validName),
        new TextNode("', pattern: /"),
        new TextNode(escapeRegExp(keyword)),
        new TextNode("/ });"));
    return { name: validName, node: keywordNode };
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
    alternative.groups?.forEach(g => {
        collectGroupKeywords(g, keywords);
    });
}

function collectGroupKeywords(group: Group, keywords: Set<string>) {
    group.items?.forEach(element => {
        if ("value" in element) {
            if (typeof(element.value) === "string") {
                keywords.add(element.value);
            } else if (Array.isArray(element.value)) {
                element.value.forEach(e => {
                    keywords.add(e.value!);
                })
            }
        } else if ("alternatives" in element) {
            element.alternatives?.forEach(a => {
                collectAlternativeKeywords(a, keywords);
            });
        }
    });
}