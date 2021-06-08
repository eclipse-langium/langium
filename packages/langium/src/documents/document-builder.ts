import { Connection } from 'vscode-languageserver/node';
import { LangiumParser } from '../parser/langium-parser';
import { LangiumServices } from '../services';
import { ScopeComputation } from '../references/scope';
import { DocumentValidator } from '../service/validation/document-validator';
import { LangiumDocument, ProcessedLangiumDocument } from './document';

export interface DocumentBuilder {
    build(document: LangiumDocument): ProcessedLangiumDocument
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

    build(document: LangiumDocument): ProcessedLangiumDocument {
        const parseResult = this.parser.parse(document);
        document.parseResult = parseResult;
        document.precomputedScopes = this.scopeComputation.computeScope(parseResult.value);
        const processed = document as ProcessedLangiumDocument;
        const diagnostics = this.documentValidator.validateDocument(processed);

        if (this.connection) {
            // Send the computed diagnostics to VS Code.
            this.connection.sendDiagnostics({ uri: document.uri, diagnostics });
        }
        return processed;
    }

}
