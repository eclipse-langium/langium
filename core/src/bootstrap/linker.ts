import { AbstractRule, AbstractTerminal, Alternatives, Assignment, Grammar, Group, ParserRule, UnorderedGroup } from "../gen/ast";
import { AstNode, CompositeCstNode, CstNode } from "../generator/ast-node";

export function linkGrammar(grammar: Grammar): void {
    findReferences(grammar, grammar);
    grammar.rules?.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(r => {
        linkAlteratives(grammar, r.Alternatives);
    });
}

function linkAlteratives(grammar: Grammar, alternatives: Alternatives) {
    if (alternatives.kind === "Alternatives") {
        alternatives.Elements.forEach(e => {
            linkUnorderedGroup(grammar, e);
        });
    } else {
        linkUnorderedGroup(grammar, alternatives);
    }
}

function linkUnorderedGroup(grammar: Grammar, group: UnorderedGroup) {
    if (group.kind === "UnorderedGroup") {
        group.Elements.forEach(e => {
            linkGroup(grammar, e)
        });
    } else {
        linkGroup(grammar, group);
    }
}

function linkGroup(grammar: Grammar, group: Group) {
    group.Elements?.forEach(e => {
        if (e.kind === "Assignment") {
            linkAssignment(grammar, e);
        } else if (e.kind === "Action") {
            findReferences(grammar, e);
        } else {
            linkTerminal(grammar, e);
        }
    });
}

function linkTerminal(grammar: Grammar, terminal: AbstractTerminal) {
    if (terminal.kind === "RuleCall") {
        findReferences(grammar, terminal);
    } else if (terminal.kind === "Alternatives" || terminal.kind === "UnorderedGroup" || terminal.kind === "Group") {
        linkAlteratives(grammar, terminal);
    } else if (terminal.kind === "PredicatedRuleCall") {
        findReferences(grammar, terminal);
    } else if (terminal.kind === "PredicatedGroup") {
        terminal.Elements.forEach(e => {
            linkAlteratives(grammar, e);
        });
    }
}

function linkAssignment(grammar: Grammar, assignment: Assignment) {
    const terminal = assignment.Terminal;
    if (terminal.kind === "CrossReference") {
        findReferences(grammar, terminal);
        if (terminal.Terminal && terminal.Terminal.kind === "RuleCall") {
            findReferences(grammar, terminal.Terminal);
        }
    } else if (terminal.kind === "RuleCall") {
        findReferences(grammar, terminal);
    } else if (terminal.kind === "AssignableAlternatives") {
        // todo
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findReferences(grammar: Grammar, ref: any) {
    if (AstNode.cstNode in ref) {
        iterateNodes(grammar, ref, ref[AstNode.cstNode]);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iterateNodes(grammar: Grammar, item: any, node: CstNode) {
    if (node.element === item && node.feature && node.feature.kind === "Assignment" && node.feature.Terminal.kind === "CrossReference") {
        const text = node.text;
        const assignment = node.feature;
        switch (assignment.Operator) {
            case "=": {
                item[assignment.Feature] = findRule(grammar, text);
                break;
            } case "+=": {
                if (!Array.isArray(item[assignment.Feature])) {
                    item[assignment.Feature] = [];
                }
                item[assignment.Feature].push(findRule(grammar, text));
                break;
            }
        }
    } else if (node instanceof CompositeCstNode) {
        node.children.forEach(e => {
            iterateNodes(grammar, item, e);
        })
    }
}

function findRule(grammar: Grammar, name: string): AbstractRule {
    const rule = grammar.rules?.find(e => e.Name === name);
    if (!rule) {
        throw new Error("Could not find rule " + name);
    }
    return rule;
}