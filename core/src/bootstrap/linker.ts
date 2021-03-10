/* eslint-disable */
import { AbstractRule, AbstractTerminal, Alternatives, Assignment, Grammar, Group, ParserRule, UnorderedGroup } from "../gen/ast";

export function linkGrammar(grammar: Grammar): void {
    grammar.rules?.filter(e => e.kind === "ParserRule").map(e => e as ParserRule).forEach(r => {
        linkAlteratives(grammar, r.Alternatives);
    });
}

function linkAlteratives(grammar: Grammar, alternatives: Alternatives) {
    alternatives.Elements.forEach(e => {
        linkUnorderedGroup(grammar, e);
    });
}

function linkUnorderedGroup(grammar: Grammar, group: UnorderedGroup) {
    group.Elements.forEach(e => linkGroup(grammar, e));
}

function linkGroup(grammar: Grammar, group: Group) {
    group.Elements?.forEach(e => {
        if (e.kind === "AbstractTokenWithCardinality") {
            if (e.Assignment) {
                linkAssignment(grammar, e.Assignment);
            } else if (e.Terminal) {
                linkTerminal(grammar, e.Terminal);
            }
        } else if (e.kind === "Action") {
            findReferences(grammar, e);
        }
    });
}

function linkTerminal(grammar: Grammar, terminal: AbstractTerminal) {
    if (terminal.kind === "RuleCall") {
        findReferences(grammar, terminal);
    } else if (terminal.kind === "ParenthesizedElement") {
        linkAlteratives(grammar, terminal.Alternatives);
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
    } else if (terminal.kind === "ParenthesizedAssignableElement") {
        // todo
    }
}

function findReferences(grammar: Grammar, ref: { [k: string]: any, '.references': Map<string, string | undefined> }) {
    const refs = ref[".references"];
    for (const [key, entry] of Array.from(refs.entries())) {
        if (entry) {
            ref[key] = findRule(grammar, entry);
        }
    }
}

function findRule(grammar: Grammar, name: string): AbstractRule {
    const rule = grammar.rules?.find(e => e.Name === name);
    if (!rule) {
        throw new Error("Could not find rule " + name);
    }
    return <AbstractRule>rule;
}