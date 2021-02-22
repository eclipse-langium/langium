import { CstChildrenDictionary, CstElement, CstNode, IToken } from "chevrotain";
import { Action, Assignment, Grammar, Group, Keyword, ParenthesizedGroup, Rule } from "./ast";

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
    const alternatives: Group[] = [];
    alternativesNodes.forEach(e => {
        alternatives.push(buildGroup(e));
    });
    rule.alternatives = alternatives;
    return rule;
}

function buildGroup(node: CstNode): Group {
    const groups: Group = { items: [] };

    const children = node.children;
    const childGroups = <CstElement[]>children["group"];

    childGroups.forEach(e => {
        groups.items!.push(buildGroupItem(e));
    });

    return groups;
}

function buildGroupItem(node: CstElement): Keyword | Assignment | Action | ParenthesizedGroup {
    
    
    return {};
}

function buildKeyword(token: IToken): Keyword {
    return {};
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
    return 0;
}