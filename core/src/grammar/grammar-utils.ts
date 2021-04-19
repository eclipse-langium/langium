import { EnumRule, Grammar, ParserRule, TerminalRule } from "../gen/ast";
import { decycle, retrocycle } from 'json-cycle';

export function serialize(grammar: Grammar): string {
    return JSON.stringify(decycle(grammar));
}

export function deserialize(content: string): Grammar {
    return <Grammar>retrocycle(JSON.parse(content));
}

export function getTypeName(rule: ParserRule | TerminalRule | EnumRule): string {
    if (rule.kind === "EnumRule") {
        return rule.Name;
    }
    return rule.Type ?? rule.Name;
}