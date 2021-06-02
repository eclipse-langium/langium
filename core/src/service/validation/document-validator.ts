import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { LangiumDiagnostic, Validator } from './validator';
import { findNodeForFeature } from '../../grammar/grammar-utils';
import { LangiumServices } from '../../services';
import { LangiumDocument } from '../../documents/document';
import { resolveAllReferences } from '../../generator/ast-util';

export interface DocumentValidator {
    validateDocument(langiumDocument: LangiumDocument, textDocument: TextDocument): Diagnostic[];
}

export class DefaultDocumentValidator {
    protected readonly validator: Validator;

    constructor(services: LangiumServices) {
        this.validator = services.validation.Validator;
    }

    validateDocument(langiumDocument: LangiumDocument, textDocument: TextDocument): Diagnostic[] {
        const parseResult = langiumDocument.parseResult;

        // TODO include lexer errors
        const diagnostics: Diagnostic[] = [];

        // Process parser errors
        for (const parserError of parseResult.parserErrors) {
            const token = parserError.token;
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(token.startOffset),
                    end: textDocument.positionAt(token.startOffset + token.image.length)
                },
                message: parserError.message
            };
            diagnostics.push(diagnostic);
        }

        // Process unresolved references
        const resolveResult = resolveAllReferences(parseResult.value);
        for (const unresolved of resolveResult.unresolved) {
            const diagnostic: LangiumDiagnostic = {
                node: unresolved.container,
                feature: unresolved.property,
                index: unresolved.index,
                severity: DiagnosticSeverity.Error,
                message: `Could not resolve reference to '${unresolved.reference.$refName}'.`
            };
            diagnostics.push(toDiagnostic(diagnostic, textDocument));
        }

        // Process custom validations
        const validationItems = this.validator.validate(parseResult.value);
        for (const validationItem of validationItems) {
            diagnostics.push(toDiagnostic(validationItem, textDocument));
        }

        return diagnostics;
    }
}

export function toDiagnostic(validationItem: LangiumDiagnostic, document: TextDocument): Diagnostic {
    const { node: item, feature, index, message, code, severity } = validationItem;
    const node = findNodeForFeature(item.$cstNode, feature, index) ?? item.$cstNode;
    let range: Range;
    if (node) {
        const start = node.offset;
        const end = start + node.length;
        range = {
            start: document.positionAt(start),
            end: document.positionAt(end)
        };
    } else {
        range = {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
        };
    }
    return { range, message, code, severity };
}
