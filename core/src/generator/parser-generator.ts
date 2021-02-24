import { Alternative, Grammar, Group, Rule, Terminal } from "../bootstrap/ast";
import { CompositeGeneratorNode, NewLineNode, TextNode } from "./node/node";
import { process } from "./node/node-processor";
import { replaceTokens } from "./token-replacer";

export function generateParser(grammar: Grammar): string {
    const keywords = collectKeywords(grammar);

    const parserNode = new CompositeGeneratorNode();
    parserNode.children.push(
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
        parserNode.children.push(e.node, new NewLineNode());
    });

    parserNode.children.push(new NewLineNode());

    keywords.forEach(e => {
        const token = buildKeywordToken(e);
        parserNode.children.push(
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

    parserNode.children.push(tokenListNode, new NewLineNode());
    parserNode.children.push(new TextNode("const lexer = new Lexer(tokens);"), new NewLineNode());

    return process(parserNode);
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
    })
}

function collectAlternativeKeywords(alternative: Alternative, keywords: Set<string>) {
    alternative.groups?.forEach(g => {
        collectGroupKeywords(g, keywords);
    })
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