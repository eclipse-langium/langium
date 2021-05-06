import { AbstractElement, AbstractRule, Action, Alternatives, Assignment, CrossReference, Grammar, Group, ParserRule, RuleCall, UnorderedGroup } from '../gen/ast';
import { AstNode, CompositeCstNode, CstNode, Reference } from '../generator/ast-node';

export function linkGrammar(grammar: Grammar): void {
    findReferences(grammar, grammar);
    for (const rule of grammar.rules.filter(e => ParserRule.is(e)).map(e => e as ParserRule)) {
        linkElement(grammar, rule.alternatives);
    }
}

function linkElement(grammar: Grammar, element: AbstractElement) {
    if (RuleCall.is(element)) {
        findReferences(grammar, element);
    } else if (Assignment.is(element)) {
        linkAssignment(grammar, element);
    } else if (Action.is(element)) {
        findReferences(grammar, element);
    } else if (Alternatives.is(element) || UnorderedGroup.is(element) || Group.is(element)) {
        for (const item of element.elements) {
            linkElement(grammar, item);
        }
    }
}

function linkAssignment(grammar: Grammar, assignment: Assignment) {
    const terminal = assignment.terminal;
    if (CrossReference.is(terminal)) {
        findReferences(grammar, terminal);
        if (RuleCall.is(terminal.terminal)) {
            findReferences(grammar, terminal.terminal);
        }
    } else if (RuleCall.is(terminal)) {
        findReferences(grammar, terminal);
    } else if (Alternatives.is(terminal)) {
        // todo
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findReferences(grammar: Grammar, ref: any) {
    if ('$cstNode' in ref) {
        iterateNodes(grammar, ref, ref.$cstNode);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iterateNodes(grammar: Grammar, item: any, node: CstNode) {
    const assignment = <Assignment>AstNode.getContainer(node.feature, Assignment.type);
    if (node.element === item && assignment && CrossReference.is(assignment.terminal)) {
        const text = node.text;
        switch (assignment.operator) {
            case '=': {
                item[assignment.feature] = findRule(grammar, text);
                break;
            } case '+=': {
                if (!Array.isArray(item[assignment.feature])) {
                    item[assignment.feature] = [];
                }
                item[assignment.feature].push(findRule(grammar, text));
                break;
            }
        }
    } else if (node.element === item && node instanceof CompositeCstNode) {
        for (const child of node.children) {
            iterateNodes(grammar, item, child);
        }
    }
}

function findRule(grammar: Grammar, name: string): Reference<AbstractRule> {
    const rule = grammar.rules.find(e => e.name === name);
    if (!rule) {
        throw new Error('Could not find rule ' + name);
    }
    return { value: rule, uri: '' };
}
