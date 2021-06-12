import { Range } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { DiagnosticInfo, ValidationAcceptor, ValidationRegistry } from './validation-registry';
import { findNodeForFeature } from '../../grammar/grammar-util';
import { LangiumServices } from '../../services';
import { ProcessedLangiumDocument } from '../../documents/document';
import { resolveAllReferences, streamAllContents } from '../../utils/ast-util';
import { AstNode } from '../../syntax-tree';

export interface DocumentValidator {
    validateDocument(document: ProcessedLangiumDocument): Diagnostic[];
}

export class DefaultDocumentValidator {
    protected readonly validationRegistry: ValidationRegistry;

    constructor(services: LangiumServices) {
        this.validationRegistry = services.validation.ValidationRegistry;
    }

    validateDocument(document: ProcessedLangiumDocument): Diagnostic[] {
        const parseResult = document.parseResult;
        const diagnostics: Diagnostic[] = [];

        // Process lexer errors
        for (const lexerError of parseResult.lexerErrors) {
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: document.positionAt(lexerError.offset),
                    end: document.positionAt(lexerError.offset + lexerError.length)
                },
                message: lexerError.message
            };
            diagnostics.push(diagnostic);
        }

        // Process parser errors
        for (const parserError of parseResult.parserErrors) {
            const token = parserError.token;
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: document.positionAt(token.startOffset),
                    end: document.positionAt(token.startOffset + token.image.length)
                },
                message: parserError.message
            };
            diagnostics.push(diagnostic);
        }

        // Process unresolved references
        const resolveResult = resolveAllReferences(parseResult.value);
        for (const unresolved of resolveResult.unresolved) {
            const message = `Could not resolve reference to '${unresolved.reference.$refName}'.`;
            const info: DiagnosticInfo<AstNode> = {
                node: unresolved.container,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                property: unresolved.property as any,
                index: unresolved.index
            };
            diagnostics.push(this.toDiagnostic('error', message, info, document));
        }

        // Process custom validations
        diagnostics.push(...this.validateAst(parseResult.value, document));

        return diagnostics;
    }

    protected validateAst(rootNode: AstNode, document: ProcessedLangiumDocument): Diagnostic[] {
        const validationItems: Diagnostic[] = [];
        const acceptor: ValidationAcceptor = <N extends AstNode>(severity: 'error' | 'warning' | 'info' | 'hint', message: string, info: DiagnosticInfo<N>) => {
            validationItems.push(this.toDiagnostic(severity, message, info, document));
        };

        const runChecks = (node: AstNode) => {
            const checks = this.validationRegistry.getChecks(node.$type);
            for (const check of checks) {
                check(node, acceptor);
            }
        };
        runChecks(rootNode);
        streamAllContents(rootNode).map(c => c.node).forEach(runChecks);
        return validationItems;
    }

    protected toDiagnostic<N extends AstNode>(severity: 'error' | 'warning' | 'info' | 'hint', message: string, info: DiagnosticInfo<N>, document: ProcessedLangiumDocument): Diagnostic {
        return {
            message,
            range: getDiagnosticRange(info, document),
            severity: toDiagnosticSeverity(severity),
            code: info.code,
            codeDescription: info.codeDescription,
            tags: info.tags,
            relatedInformation: info.relatedInformation,
            data: info.data
        };
    }
}

export function getDiagnosticRange<N extends AstNode>(info: DiagnosticInfo<N>, document: ProcessedLangiumDocument): Range {
    if (info.range) {
        return info.range;
    }
    if (info.property !== undefined && typeof info.property !== 'string') {
        throw new Error('Invalid property: ' + info.property);
    }
    const cstNode = findNodeForFeature(info.node.$cstNode, info.property, info.index) ?? info.node.$cstNode;
    if (!cstNode) {
        return {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
        };
    }
    const start = cstNode.offset;
    const end = start + cstNode.length;
    return {
        start: document.positionAt(start),
        end: document.positionAt(end)
    };
}

export function toDiagnosticSeverity(severity: 'error' | 'warning' | 'info' | 'hint'): DiagnosticSeverity {
    switch (severity) {
        case 'error':
            return DiagnosticSeverity.Error;
        case 'warning':
            return DiagnosticSeverity.Warning;
        case 'info':
            return DiagnosticSeverity.Information;
        case 'hint':
            return DiagnosticSeverity.Hint;
        default:
            throw new Error('Invalid diagnostic severity: ' + severity);
    }
}
