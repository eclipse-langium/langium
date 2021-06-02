import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection } from 'vscode-languageserver/node';
import { LangiumParser } from '../parser/langium-parser';
import { LangiumServices } from '../services';
import { ScopeComputation } from '../references/scope';
import { DocumentValidator } from '../service/validation/document-validator';

export interface DocumentBuilder {
    build(textDocument: TextDocument, event: 'change' | 'open' | 'close'): void
}

export class DefaultDocumentBuilder implements DocumentBuilder {
    protected readonly connection?: Connection;
    protected readonly parser: LangiumParser;
    protected readonly scopeComputation: ScopeComputation;
    protected readonly documentValidator: DocumentValidator;

    constructor(services: LangiumServices) {
        this.connection = services.languageServer.Connection;
        this.parser = services.Parser;
        this.scopeComputation = services.references.ScopeComputation;
        this.documentValidator = services.validation.DocumentValidator;
    }

    build(textDocument: TextDocument, event: 'change' | 'open' | 'close'): void {
        if (event === 'close') {
            return;
        }
        // TODO shall we store the parsed documents somewhere in memory?
        const langiumDoc = this.parser.parse(textDocument.getText(), textDocument.uri);
        langiumDoc.precomputedScopes = this.scopeComputation.computeScope(langiumDoc.parseResult.value);
        const diagnostics = this.documentValidator.validateDocument(langiumDoc, textDocument);

        if (this.connection) {
            // Send the computed diagnostics to VS Code.
            this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
        }
    }

}
