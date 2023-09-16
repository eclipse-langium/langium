/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { MismatchedTokenException } from 'chevrotain';
import type { DiagnosticSeverity, Position, Range, Diagnostic } from 'vscode-languageserver-types';
import type { LanguageMetaData } from '../languages/language-meta-data.js';
import type { ParseResult } from '../parser/langium-parser.js';
import type { LangiumCoreServices } from '../services.js';
import type { AstNode, CstNode } from '../syntax-tree.js';
import type { LangiumDocument } from '../workspace/documents.js';
import type { DiagnosticData, DiagnosticInfo, ValidationAcceptor, ValidationCategory, ValidationRegistry } from './validation-registry.js';
import { CancellationToken } from '../utils/cancellation.js';
import { findNodeForKeyword, findNodeForProperty } from '../utils/grammar-utils.js';
import { streamAst } from '../utils/ast-utils.js';
import { tokenToRange } from '../utils/cst-utils.js';
import { interruptAndCheck, isOperationCancelled } from '../utils/promise-utils.js';
import { diagnosticData } from './validation-registry.js';

export interface ValidationOptions {
    /**
     * If this is set, only the checks associated with these categories are executed; otherwise
     * all checks are executed. The default category if not specified to the registry is `'fast'`.
     */
    categories?: ValidationCategory[];
    /** If true, no further diagnostics are reported if there are lexing errors. */
    stopAfterLexingErrors?: boolean
    /** If true, no further diagnostics are reported if there are parsing errors. */
    stopAfterParsingErrors?: boolean
    /** If true, no further diagnostics are reported if there are linking errors. */
    stopAfterLinkingErrors?: boolean
}

/**
 * Language-specific service for validating `LangiumDocument`s.
 */
export interface DocumentValidator {
    /**
     * Validates the whole specified document.
     *
     * @param document specified document to validate
     * @param options options to control the validation process
     * @param cancelToken allows to cancel the current operation
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    validateDocument(document: LangiumDocument, options?: ValidationOptions, cancelToken?: CancellationToken): Promise<Diagnostic[]>;
}

export class DefaultDocumentValidator implements DocumentValidator {

    protected readonly validationRegistry: ValidationRegistry;
    protected readonly metadata: LanguageMetaData;

    constructor(services: LangiumCoreServices) {
        this.validationRegistry = services.validation.ValidationRegistry;
        this.metadata = services.LanguageMetaData;
    }

    async validateDocument(document: LangiumDocument, options: ValidationOptions = {}, cancelToken = CancellationToken.None): Promise<Diagnostic[]> {
        const parseResult = document.parseResult;
        const diagnostics: Diagnostic[] = [];

        await interruptAndCheck(cancelToken);

        if (!options.categories || options.categories.includes('built-in')) {
            this.processLexingErrors(parseResult, diagnostics, options);
            if (options.stopAfterLexingErrors && diagnostics.some(d => d.data?.code === DocumentValidator.LexingError)) {
                return diagnostics;
            }

            this.processParsingErrors(parseResult, diagnostics, options);
            if (options.stopAfterParsingErrors && diagnostics.some(d => d.data?.code === DocumentValidator.ParsingError)) {
                return diagnostics;
            }

            this.processLinkingErrors(document, diagnostics, options);
            if (options.stopAfterLinkingErrors && diagnostics.some(d => d.data?.code === DocumentValidator.LinkingError)) {
                return diagnostics;
            }
        }

        // Process custom validations
        try {
            diagnostics.push(...await this.validateAst(parseResult.value, options, cancelToken));
        } catch (err) {
            if (isOperationCancelled(err)) {
                throw err;
            }
            console.error('An error occurred during validation:', err);
        }

        await interruptAndCheck(cancelToken);

        return diagnostics;
    }

    protected processLexingErrors(parseResult: ParseResult, diagnostics: Diagnostic[], _options: ValidationOptions): void {
        for (const lexerError of parseResult.lexerErrors) {
            const diagnostic: Diagnostic = {
                severity: toDiagnosticSeverity('error'),
                range: {
                    start: {
                        line: lexerError.line! - 1,
                        character: lexerError.column! - 1
                    },
                    end: {
                        line: lexerError.line! - 1,
                        character: lexerError.column! + lexerError.length - 1
                    }
                },
                message: lexerError.message,
                data: diagnosticData(DocumentValidator.LexingError),
                source: this.getSource()
            };
            diagnostics.push(diagnostic);
        }
    }

    protected processParsingErrors(parseResult: ParseResult, diagnostics: Diagnostic[], _options: ValidationOptions): void {
        for (const parserError of parseResult.parserErrors) {
            let range: Range | undefined = undefined;
            // We can run into the chevrotain error recovery here
            // The token contained in the parser error might be automatically inserted
            // In this case every position value will be `NaN`
            if (isNaN(parserError.token.startOffset)) {
                // Some special parser error types contain a `previousToken`
                // We can simply append our diagnostic to that token
                if ('previousToken' in parserError) {
                    const token = (parserError as MismatchedTokenException).previousToken;
                    if (!isNaN(token.startOffset)) {
                        const position: Position = { line: token.endLine! - 1, character: token.endColumn! };
                        range = { start: position, end: position};
                    } else {
                        // No valid prev token. Might be empty document or containing only hidden tokens.
                        // Point to document start
                        const position: Position = { line: 0, character: 0 };
                        range = { start: position, end: position};
                    }
                }
            } else {
                range = tokenToRange(parserError.token);
            }
            if (range) {
                const diagnostic: Diagnostic = {
                    severity: toDiagnosticSeverity('error'),
                    range,
                    message: parserError.message,
                    data: diagnosticData(DocumentValidator.ParsingError),
                    source: this.getSource()
                };
                diagnostics.push(diagnostic);
            }
        }
    }

    protected processLinkingErrors(document: LangiumDocument, diagnostics: Diagnostic[], _options: ValidationOptions): void {
        for (const reference of document.references) {
            const linkingError = reference.error;
            if (linkingError) {
                const info: DiagnosticInfo<AstNode, string> = {
                    node: linkingError.info.container,
                    property: linkingError.info.property,
                    index: linkingError.info.index,
                    data: {
                        code: DocumentValidator.LinkingError,
                        containerType: linkingError.info.container.$type,
                        property: linkingError.info.property,
                        refText: linkingError.info.reference.$refText
                    } satisfies LinkingErrorData
                };
                diagnostics.push(this.toDiagnostic('error', linkingError.message, info));
            }
        }
    }

    protected async validateAst(rootNode: AstNode, options: ValidationOptions, cancelToken = CancellationToken.None): Promise<Diagnostic[]> {
        const validationItems: Diagnostic[] = [];
        const acceptor: ValidationAcceptor = <N extends AstNode>(severity: 'error' | 'warning' | 'info' | 'hint', message: string, info: DiagnosticInfo<N>) => {
            validationItems.push(this.toDiagnostic(severity, message, info));
        };

        await Promise.all(streamAst(rootNode).map(async node => {
            await interruptAndCheck(cancelToken);
            const checks = this.validationRegistry.getChecks(node.$type, options.categories);
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
    let cstNode: CstNode | undefined;
    if (typeof info.property === 'string') {
        cstNode = findNodeForProperty(info.node.$cstNode, info.property, info.index);
    } else if (typeof info.keyword === 'string') {
        cstNode = findNodeForKeyword(info.node.$cstNode, info.keyword, info.index);
    }
    cstNode ??= info.node.$cstNode;
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
            return 1; // according to vscode-languageserver-types/lib/esm/main.js#DiagnosticSeverity.Error
        case 'warning':
            return 2; // according to vscode-languageserver-types/lib/esm/main.js#DiagnosticSeverity.Warning
        case 'info':
            return 3; // according to vscode-languageserver-types/lib/esm/main.js#DiagnosticSeverity.Information
        case 'hint':
            return 4; // according to vscode-languageserver-types/lib/esm/main.js#DiagnosticSeverity.Hint
        default:
            throw new Error('Invalid diagnostic severity: ' + severity);
    }
}

export namespace DocumentValidator {
    export const LexingError = 'lexing-error';
    export const ParsingError = 'parsing-error';
    export const LinkingError = 'linking-error';
}

export interface LinkingErrorData extends DiagnosticData {
    containerType: string
    property: string
    refText: string
}
