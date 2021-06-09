import { AbstractRule, Grammar, ParserRule } from '../grammar/generated/ast';
import { findAllFeatures, loadGrammar } from '../grammar/grammar-util';

export abstract class GrammarAccess {

    readonly grammar: Grammar;

    constructor(grammar: Grammar) {
        this.grammar = loadGrammar(JSON.stringify(grammar));
    }

    findRuleByName(name: string): AbstractRule {
        const result = this.grammar.rules.find(e => e.name === name);
        if (!result) {
            throw new Error('Rule not found: ' + name);
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
