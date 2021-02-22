import { CstChildrenDictionary, CstElement, CstNode, IToken } from "chevrotain";
import { Action, Alternative, Assignment, AssignType, Cardinality, CrossReference, Grammar, Group, Keyword, ParenthesizedGroup, Rule } from "./ast";

export function linkGrammar(grammar: Grammar) {
    
}

export function buildGrammar(node: CstNode): Grammar {

    const children = node.children;
    const grammar: Grammar = {};
    const nameNode = <IToken>children["name"]![0];
    grammar.name = nameNode.image;

    const rules: Rule[] = [];

    const ruleNodes = <CstNode[]>children["rule"];

    ruleNodes.forEach(e => {
        rules.push(buildRule(e));
    });

    grammar.rules = rules;

    return grammar;

}

function buildRule(node: CstNode): Rule {
    const rule: Rule = {};
    const children = node.children;
    const nameNode = <IToken>children["name"]![0];
    rule.name = nameNode.image;
    const alternativesNodes = <CstNode[]>children["alternatives"];
    const alternatives: Alternative[] = [];
    alternativesNodes.forEach(e => {
        alternatives.push(buildAlternative(e));
    });
    rule.alternatives = alternatives;
    return rule;
}

function buildAlternative(node: CstNode): Alternative {
    const alternative: Alternative = { groups: [] };
    const children = node.children;
    const groupNodes = <CstNode[]>children["group"];

    groupNodes.forEach(e => {
        alternative.groups!.push(buildGroup(e));
    })

    return alternative;
}

function buildGroup(node: CstNode): Group {
    const groups: Group = { items: [] };

    const children = collectChildren(node.children);

    children.forEach(e => {
        groups.items!.push(buildGroupItem(e));
    });

    return groups;
}

function buildGroupItem(element: CstElement): Keyword | Assignment | Action | ParenthesizedGroup {
    
    if ("image" in element) {
        return buildKeyword(element);
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
    
    return {};
}

function buildAction(node: CstNode): Action {
    const children = node.children;
    const nameNode = <IToken>children["name"]![0];
    const name = nameNode.image;

    if (children["variable"]) {
        const variableNode = <IToken>children["variable"]![0];
        const assignNode = <IToken>children["assign"]![0];
        const assignType = <AssignType>assignNode.image;
        return { name, type: assignType, variable: variableNode.image };
    }
    
    return { name };
}

function buildParenthesizedGroup(node: CstNode): ParenthesizedGroup {
    const alternativesNodes = <CstNode[]>node.children["alternatives"];
    const alternatives: Alternative[] = [];
    alternativesNodes.forEach(e => {
        alternatives.push(buildAlternative(e));
    });
    const cardTokens = node.children["card"];
    let cardinality: Cardinality | undefined;
    if (cardTokens) {
        cardinality = <Cardinality>(cardTokens![0] as IToken).image;
    }
    return { alternatives, cardinality };
}

function buildKeyword(token: IToken): Keyword {
    return { value: token.image };
}

function buildAssignment(node: CstNode): Assignment {
    const assignment: Assignment = {};
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
        assignment.value = keywords;
    } else {
        assignment.value = buildAssignmentValue((valueChild ?? crossReferenceChild)![0]);
    }
    const cardTokens = node.children["card"];
    if (cardTokens) {
        assignment.cardinality = <Cardinality>(cardTokens![0] as IToken).image;
    }
    return assignment;
}

function buildAssignmentValue(element: CstElement): CrossReference | string {
    if ("image" in element) {
        return element.image;
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
    return { target, type };
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