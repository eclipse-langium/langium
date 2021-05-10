import * as ast from '../gen/ast';
import { AstNode, CompositeCstNode, CstNode, Reference } from '../generator/ast-node';

export function linkGrammar(grammar: ast.Grammar): void {
    findReferences(grammar, grammar);
    for (const rule of grammar.rules.filter(e => ast.isParserRule(e)).map(e => e as ast.ParserRule)) {
        linkElement(grammar, rule.alternatives);
    }
}

function linkElement(grammar: ast.Grammar, element: ast.AbstractElement) {
    if (ast.isRuleCall(element)) {
        findReferences(grammar, element);
    } else if (ast.isAssignment(element)) {
        linkAssignment(grammar, element);
    } else if (ast.isAction(element)) {
        findReferences(grammar, element);
    } else if (ast.isAlternatives(element) || ast.isUnorderedGroup(element) || ast.isGroup(element)) {
        for (const item of element.elements) {
            linkElement(grammar, item);
        }
    }
}

function linkAssignment(grammar: ast.Grammar, assignment: ast.Assignment) {
    const terminal = assignment.terminal;
    if (ast.isCrossReference(terminal)) {
        findReferences(grammar, terminal);
        if (ast.isRuleCall(terminal.terminal)) {
            findReferences(grammar, terminal.terminal);
        }
    } else if (ast.isRuleCall(terminal)) {
        findReferences(grammar, terminal);
    } else if (ast.isAlternatives(terminal)) {
        // todo
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findReferences(grammar: ast.Grammar, ref: any) {
    if ('$cstNode' in ref) {
        iterateNodes(grammar, ref, ref.$cstNode);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iterateNodes(grammar: ast.Grammar, item: any, node: CstNode) {
    const assignment = <ast.Assignment>AstNode.getContainer(node.feature, ast.Assignment.type);
    if (node.element === item && assignment && ast.isCrossReference(assignment.terminal)) {
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

function findRule(grammar: ast.Grammar, name: string): Reference<ast.AbstractRule> {
    const rule = grammar.rules.find(e => e.name === name);
    if (!rule) {
        throw new Error('Could not find rule ' + name);
    }
    return { value: rule, uri: '' };
}
