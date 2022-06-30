/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Diagnostic, DiagnosticSeverity, PublishDiagnosticsClientCapabilities } from 'vscode-languageserver';
import { Range } from 'vscode-languageserver-textdocument';
import { findNodeForFeature } from '../grammar/grammar-util';
import { LanguageMetaData } from '../grammar/language-meta-data';
import { InitializableService, LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { streamAst } from '../utils/ast-util';
import { tokenToRange } from '../utils/cst-util';
import { interruptAndCheck, isOperationCancelled } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';
import { DiagnosticInfo, ValidationAcceptor, ValidationRegistry } from './validation-registry';

/**
 * Language-specific service for validating `LangiumDocument`s.
 */
export interface DocumentValidator extends InitializableService<PublishDiagnosticsClientCapabilities> {
    /**
     * Validates the whole specified document.
     * @param document specified document to validate
     * @param cancelToken allows to cancel the current operation
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    validateDocument(document: LangiumDocument, cancelToken?: CancellationToken): Promise<Diagnostic[]>;
}

export class DefaultDocumentValidator implements DocumentValidator {
    protected readonly validationRegistry: ValidationRegistry;
    protected readonly metadata: LanguageMetaData;

    constructor(services: LangiumServices) {
        this.validationRegistry = services.validation.ValidationRegistry;
        this.metadata = services.LanguageMetaData;
    }

    async validateDocument(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<Diagnostic[]> {
        const parseResult = document.parseResult;
        const diagnostics: Diagnostic[] = [];

        await interruptAndCheck(cancelToken);

        // Process lexing errors
        for (const lexerError of parseResult.lexerErrors) {
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: {
                        line: lexerError.line - 1,
                        character: lexerError.column - 1
                    },
                    end: {
                        line: lexerError.line - 1,
                        character: lexerError.column + lexerError.length - 1
                    }
                },
                message: lexerError.message,
                code: DocumentValidator.LexingError,
                source: this.getSource()
            };
            diagnostics.push(diagnostic);
        }

        // Process parsing errors
        for (const parserError of parseResult.parserErrors) {
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: tokenToRange(parserError.token),
                message: parserError.message,
                code: DocumentValidator.ParsingError,
                source: this.getSource()
            };
            diagnostics.push(diagnostic);
        }

        // Process unresolved references
        for (const reference of document.references) {
            const linkingError = reference.error;
            if (linkingError) {
                const data: LinkingErrorData = {
                    containerType: linkingError.container.$type,
                    property: linkingError.property,
                    refText: linkingError.reference.$refText
                };
                const info: DiagnosticInfo<AstNode, string> = {
                    node: linkingError.container,
                    property: linkingError.property,
                    index: linkingError.index,
                    code: DocumentValidator.LinkingError,
                    data
                };
                diagnostics.push(this.toDiagnostic('error', linkingError.message, info));
            }
        }

        // Process custom validations
        try {
            diagnostics.push(...await this.validateAst(parseResult.value, document, cancelToken));
        } catch (err) {
            if (isOperationCancelled(err)) {
                throw err;
            }
            console.error('An error occurred during validation:', err);
        }

        await interruptAndCheck(cancelToken);

        return diagnostics;
    }

    protected async validateAst(rootNode: AstNode, document: LangiumDocument, cancelToken = CancellationToken.None): Promise<Diagnostic[]> {
        const validationItems: Diagnostic[] = [];
        const acceptor: ValidationAcceptor = <N extends AstNode>(severity: 'error' | 'warning' | 'info' | 'hint', message: string, info: DiagnosticInfo<N>) => {
            validationItems.push(this.toDiagnostic(severity, message, info));
        };

        await Promise.all(streamAst(rootNode).map(async node => {
            await interruptAndCheck(cancelToken);
            const checks = this.validationRegistry.getChecks(node.$type);
            for (const check of checks) {
                await check(node, acceptor, cancelToken);
            }
        }));
        return validationItems;
    }

    protected toDiagnostic<N extends AstNode>(severity: 'error' | 'warning' | 'info' | 'hint', message: string, info: DiagnosticInfo<N, string>): Diagnostic {
        return {
            message,
            range: getDiagnosticRange(info),
            severity: toDiagnosticSeverity(severity),
            code: info.code,
            codeDescription: info.codeDescription,
            tags: info.tags,
            relatedInformation: info.relatedInformation,
            data: info.data,
            source: this.getSource()
        };
    }

    protected getSource(): string | undefined {
        return this.metadata.languageId;
    }
}

export function getDiagnosticRange<N extends AstNode>(info: DiagnosticInfo<N, string>): Range {
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
    return cstNode.range;
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

export namespace DocumentValidator {
    export const LexingError = 'lexing-error';
    export const ParsingError = 'parsing-error';
    export const LinkingError = 'linking-error';
}

export interface LinkingErrorData {
    containerType: string
    property: string
    refText: string
}
