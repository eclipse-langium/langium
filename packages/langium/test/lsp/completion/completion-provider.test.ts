import { createLangiumGrammarServices, LangiumDocumentConfiguration, ParserRule } from '../../../lib';

describe('Completion Provider', () => {
    test('case insensitive prefix matching', () => {
        const services = createLangiumGrammarServices();
        const model = `grammar g
        Aaaa: name="A";
        aaaa: name="a";
        Bbbb: name="B";
        C: a=aa;`;
        const document = LangiumDocumentConfiguration.create('', 'langium', 0, model);
        const parser = services.parser.LangiumParser;
        const parseResult = parser.parse(document);
        expect(parseResult.lexerErrors.length).toBe(0);
        expect(parseResult.parserErrors.length).toBe(0);
        document.parseResult = parseResult;
        document.precomputedScopes = services.references.ScopeComputation.computeScope(document);
        const rootNode = parseResult.value;
        const completionProvider =services.lsp.completion.CompletionProvider;
        const completions = completionProvider.getCompletion(rootNode, model.lastIndexOf('aa') + 2);
        expect(completions.items.some(e=>e.label === 'Aaaa' && e.detail === ParserRule)).toBe(true);
        expect(completions.items.some(e=>e.label === 'aaaa' && e.detail === ParserRule)).toBe(true);
        expect(completions.items.some(e=>e.label === 'Bbbb')).toBe(false);
    });
});
