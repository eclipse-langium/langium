import { AbstractRule, EnumRule, Grammar, ParserRule, TerminalRule } from '../gen/ast';
import { decycle, retrocycle } from 'json-cycle';

export function serialize(grammar: Grammar): string {
    return JSON.stringify(decycle(grammar));
}

export function deserialize(content: string): Grammar {
    return <Grammar>retrocycle(JSON.parse(content));
}


export function getTypeName(rule: AbstractRule): string {
    if (EnumRule.is(rule)) {
        return rule.name;
    } else if (TerminalRule.is(rule) || ParserRule.is(rule)) {
        return rule.type ?? rule.name;
    } else {
        throw new Error('Unknown rule type');
    }
}
