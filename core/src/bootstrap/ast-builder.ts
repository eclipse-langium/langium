/* eslint-disable */
import { CstChildrenDictionary, CstElement, CstNode, IToken } from "chevrotain";
import { Action, Alternative, Assignment, AssignType, Cardinality, CrossReference, Grammar, Group, Keyword, ParenthesizedGroup, Rule, RuleCall, Terminal } from "./ast";

export function linkGrammar(grammar: Grammar) {
    grammar.rules?.filter(e => e.kind == "rule").map(e => e as Rule).forEach(r => {
        r.alternatives?.forEach(a => {
            linkAlterative(grammar, a);
        })
    })
}

function linkAlterative(grammar: Grammar, alternative: Alternative) {
    linkGroup(grammar, alternative.group!);
}

function linkGroup(grammar: Grammar, group: Group) {
    group.items?.forEach(e => {
        // assignments
        if ("name" in e && "type" in e && "value" in e && e.value) {
            const v = e.value;
            // assignment rule call
            if (v.kind === "rule-call") {
                e.value = findRule(grammar, v.name!);
            // cross references
            } else if ("target" in v) {
                v.target = findRule(grammar, v.target?.name!);
            } else if ("type" in v) {
                v.type = findRule(grammar, v.type?.name!);
            }
        // direct rule call
        } else if (e.kind == "rule-call") {
            e.rule = findRule(grammar, e.name!)?.rule;
        } else if ("alternatives" in e) {
            e.alternatives?.forEach(a => {
                linkAlterative(grammar, a);
            });
        }
    });
}

function findRule(grammar: Grammar, name: string): RuleCall | undefined {
    const rule = grammar.rules?.find(e => e.name === name);
    if (!rule) {
        throw new Error("Could not find rule " + name);
    }
    return { kind: "rule-call", rule, name };
}

export function buildGrammar(node: CstNode): Grammar {

    const children = node.children;
    const grammar: Grammar = { kind: "grammar" };
    const nameNode = <IToken>children["name"]![0];
    grammar.name = nameNode.image;

    const rules: (Rule | Terminal)[] = [];

    const ruleNodes = <CstNode[]>children["rule"];

    ruleNodes.forEach(e => {
        rules.push(buildRule(e));
    });

    const terminalNodes = <CstNode[]>children["terminal"];

    terminalNodes.forEach(e => {
        rules.push(buildTerminal(e));
    })

    grammar.rules = rules;

    return grammar;

}

function buildTerminal(node: CstNode): Terminal {
    const terminal: Terminal = { kind: "terminal" };
    const children = node.children;
    const nameNode = <IToken>children["name"]![0];
    terminal.name = nameNode.image;
    const returnNodes = children["returnType"];
    if (returnNodes) {
        terminal.returnType = (<IToken>returnNodes[0]).image;
    }
    const regexNode = <IToken>children["regex"]![0];
    terminal.regex = regexNode.image;
    return terminal;
}

function buildRule(node: CstNode): Rule {
    const rule: Rule = { kind: "rule" };
    const children = node.children;
    const nameNode = <IToken>children["name"]![0];
    rule.name = nameNode.image;
    const returnNodes = children["returnType"];
    if (returnNodes) {
        rule.returnType = (<IToken>returnNodes[0]).image;
    }
    const alternativesNode = <CstNode>children["alternatives"]![0];
    const groupNodes = <CstNode[]>alternativesNode.children["group"];
    const alternatives: Alternative[] = [];
    groupNodes.forEach(e => {
        alternatives.push(buildAlternative(e));
    });
    rule.alternatives = alternatives;
    return rule;
}

function buildAlternative(node: CstNode): Alternative {
    const alternative: Alternative = { kind: "alternative" };
    alternative.group = buildGroup(node);
    return alternative;
}

function buildGroup(node: CstNode): Group {
    const groups: Group = { kind: "group", items: [] };

    const children = collectChildren(node.children);

    children.forEach(e => {
        groups.items!.push(buildGroupItem(e));
    });

    return groups;
}

function buildGroupItem(element: CstElement): Keyword | RuleCall | Assignment | Action | ParenthesizedGroup {
    
    if ("image" in element) {
        if (element.tokenType.name == "Id") {
            return { kind: "rule-call", name: element.image };
        } else {
            return buildKeyword(element);
        }
    }
    const node = element as CstNode;
    if (node.name === "assignment") {
        return buildAssignment(node);
    }
    if (node.name === "action") {
        return buildAction(node);
    }
    if (node.name === "parenthesizedGroup") {
        return buildParenthesizedGroup(node);
    }
    throw new Error();
}

function buildAction(node: CstNode): Action {
    const children = node.children;
    const nameNode = <IToken>children["name"]![0];
    const name = nameNode.image;

    if (children["variable"]) {
        const variableNode = <IToken>children["variable"]![0];
        const assignNode = <IToken>children["assign"]![0];
        const assignType = <AssignType>assignNode.image;
        return { kind: "action", name, type: assignType, variable: variableNode.image };
    }
    
    return { kind: "action", name };
}

function buildParenthesizedGroup(node: CstNode): ParenthesizedGroup {
    const alternativesNode = <CstNode>node.children["alternatives"]![0];
    const groupNodes = <CstNode[]>alternativesNode.children["group"];
    const alternatives: Alternative[] = [];
    groupNodes.forEach(e => {
        alternatives.push(buildAlternative(e));
    });
    const cardTokens = node.children["card"];
    let cardinality: Cardinality | undefined;
    if (cardTokens) {
        cardinality = <Cardinality>(cardTokens![0] as IToken).image;
    }
    return { kind: "parenthesized-group", alternatives, cardinality };
}

function buildKeyword(token: IToken): Keyword {
    return { kind: "keyword", value: token.image.substring(1, token.image.length - 1) };
}

function buildAssignment(node: CstNode): Assignment {
    const assignment: Assignment = { kind: "assignment" };
    const children = node.children;
    const nameNode = children["name"]![0] as IToken;
    assignment.name = nameNode.image;
    const assignNode = children["assign"]![0] as IToken;
    assignment.type = <AssignType>assignNode.image;
    const valueChild = children["value"];
    const keywordChild = children["keyword"];
    const crossReferenceChild = children["crossReference"];
    if (keywordChild) {
        const keywords: Keyword[] = [];
        keywordChild.forEach(element => {
            keywords.push(buildKeyword(<IToken>element));
        });
        assignment.value = {
            kind: "parenthesized-assignable-element",
            items: keywords
        };
    } else {
        assignment.value = buildAssignmentValue((valueChild ?? crossReferenceChild)![0]);
    }
    const cardTokens = node.children["card"];
    if (cardTokens) {
        assignment.cardinality = <Cardinality>(cardTokens![0] as IToken).image;
    }
    return assignment;
}

function buildAssignmentValue(element: CstElement): CrossReference | RuleCall {
    if ("image" in element) {
        return {
            kind: "rule-call",
            name: element.image
        };
    }
    const node = element as CstNode;
    return buildCrossReference(node);
}

function buildCrossReference(node: CstNode): CrossReference {
    const children = node.children;
    const target = (<IToken>children["target"]![0]).image;
    let type: string | undefined;
    if (children["type"]) {
        type = (<IToken>children["type"]![0]).image;
    }
    return { 
        kind: "cross-reference", 
        target: {
            kind: "rule-call",
            name: target
        }, 
        type: {
            kind: "rule-call",
            name: type
        } 
    };
}

function collectChildren(children: CstChildrenDictionary): CstElement[] {
    const items: CstElement[] = [];

    for (const key of Object.keys(children)) {
        const childItems = <CstElement[]>children[key];
        items.push(...childItems);
    }

    return items.sort(compare);
}

function compare(a: CstElement, b: CstElement): number {
    return getOffset(a) - getOffset(b);
}

function getOffset(element: CstElement): number {
    if ("startOffset" in element) {
        return element.startOffset;
    } else if ("location" in element) {
        return element.location!.startOffset;
    } else {
        return 0;
    }
}