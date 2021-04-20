import { AbstractRule, Grammar, ParserRule } from "../gen/ast";
import { findAllFeatures } from "../generator/utils";
import { getRuleName } from "./grammar-utils";

export class GrammarAccess {

    private grammar: Grammar;

    constructor(grammar: Grammar) {
        this.grammar = grammar;
    }

    findRuleByName(name: string): AbstractRule {
        const result = this.grammar.rules.find(e => getRuleName(e) === name);
        if (!result) {
            throw new Error();
        }
        return result;
    }

    protected buildAccess<T>(name: string): T {
        const rule = <ParserRule>this.findRuleByName(name);
        const { byName } = findAllFeatures(rule);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const access: any = {};
        for (const [name, value] of Array.from(byName.entries())) {
            access[name] = value.feature;
        }
        return <T>access;
    }
}