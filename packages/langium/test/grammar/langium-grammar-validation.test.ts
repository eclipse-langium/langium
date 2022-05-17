import { CancellationTokenSource, DiagnosticSeverity } from "vscode-languageserver";
import { createLangiumGrammarServices, Grammar, ValidationAcceptor, toDiagnosticSeverity } from "../../src";
import { LangiumGrammarValidationRegistry } from "../../src/grammar/langium-grammar-validator";
import { parseHelper } from "../../src/test";

describe('Grammar validation', () => {
    const services = createLangiumGrammarServices();
    const validations = new LangiumGrammarValidationRegistry(services.grammar);
    const parser = parseHelper<Grammar>(services.grammar);
    const grammarText = `
    grammar Test

    entry Main returns X
      : age=NUMBER same=NUMBER;

    terminal NUMBER returns number: [\d]+;

    interface X {
      name: string;
      same: number;
    }
    `;

    const diagnostics: { severity: DiagnosticSeverity, message: string }[] = [];
    beforeAll(async () => {
        const grammar = (await parser(grammarText)).parseResult.value;
        const accept: ValidationAcceptor = (severity, message, info) => {
            console.log(message)
            diagnostics.push({ severity: toDiagnosticSeverity(severity), message });
        };
        validations.getChecks('Grammar').flatMap(ch => ch(grammar, accept, new CancellationTokenSource().token))
    });

    test('Property is unknown to the usage of X', () => {
        expect(diagnostics.filter(d => /A property 'age' is not expected./.test(d.message)).length).toBe(1);
    });

    test('Property is unknown in the definition of X.', () => {
        expect(diagnostics.filter(d => /A property 'name' is expected in a rule that returns type 'X'./.test(d.message)).length).toBe(1);
    });

});