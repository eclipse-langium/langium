import { LangiumServices } from '../services';
import { LangiumDocument, LangiumDocumentConfiguration } from '../documents/document';
import { AbstractRule, Grammar, ParserRule } from '../grammar/generated/ast';
import { findAllFeatures } from '../grammar/grammar-util';

export abstract class GrammarAccess {

    readonly grammar: Grammar;

    constructor(services: LangiumServices, grammar: Grammar) {
        // TODO: This looks like it only works for the Langium grammar.
        // Find an easier way to compute scopes for Langium grammars.
        this.grammar = services.serializer.JsonSerializer.retrocycle(grammar);
        const document = LangiumDocumentConfiguration.create('', 'langium', 0, '');
        document.parseResult = {
            lexerErrors: [],
            parserErrors: [],
            value: this.grammar
        };
        (this.grammar as { $document: LangiumDocument }).$document = document;
        document.precomputedScopes = services.references.ScopeComputation.computeScope(this.grammar);
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
