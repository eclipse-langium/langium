/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken, CodeDescription, DiagnosticRelatedInformation, DiagnosticTag, integer, Range } from 'vscode-languageserver';
import type { LangiumServices } from '../services';
import type { AstNode, AstReflection, Properties } from '../syntax-tree';
import type { MaybePromise } from '../utils/promise-util';
import type { Stream } from '../utils/stream';
import { MultiMap } from '../utils/collections';
import { isOperationCancelled } from '../utils/promise-util';
import { stream } from '../utils/stream';

export type DiagnosticInfo<N extends AstNode, P = Properties<N>> = {
    /** The AST node to which the diagnostic is attached. */
    node: N;
    /** If a property name is given, the diagnostic is restricted to the corresponding text region. */
    property?: P;
    /** If the value of a keyword is given, the diagnostic will appear at its corresponding text region */
    keyword?: string;
    /** In case of a multi-value property (array), an index can be given to select a specific element. */
    index?: number;
    /** If you want to create a diagnostic independent to any property, use the range property. */
    range?: Range;
    /** The diagnostic's code, which usually appear in the user interface. */
    code?: integer | string;
    /** An optional property to describe the error code. */
    codeDescription?: CodeDescription;
    /** Additional metadata about the diagnostic. */
    tags?: DiagnosticTag[];
    /** An array of related diagnostic information, e.g. when symbol-names within a scope collide all definitions can be marked via this property. */
    relatedInformation?: DiagnosticRelatedInformation[];
    /** A data entry field that is preserved between a `textDocument/publishDiagnostics` notification and `textDocument/codeAction` request. */
    data?: unknown;
}

export type ValidationAcceptor = <N extends AstNode>(severity: 'error' | 'warning' | 'info' | 'hint', message: string, info: DiagnosticInfo<N>) => void

export type ValidationCheck<T extends AstNode = AstNode> = (node: T, accept: ValidationAcceptor, cancelToken: CancellationToken) => MaybePromise<void>;

/**
 * A utility type for associating non-primitive AST types to corresponding validation checks. For example:
 *
 * ```ts
 *   const checks: ValidationChecks<StatemachineAstType> = {
 *       State: validator.checkStateNameStartsWithCapital
 *    };
 * ```
 *
 * If an AST type does not extend AstNode, e.g. if it describes a union of string literals, that type's name must not occur as a key in objects of type `ValidationCheck<...>`.
 *
 * @param T a type definition mapping language specific type names (keys) to the corresponding types (values)
 */
export type ValidationChecks<T> = {
    [K in keyof T]?: T[K] extends AstNode ? ValidationCheck<T[K]> | Array<ValidationCheck<T[K]>> : never
} & {
    AstNode?: ValidationCheck<AstNode>;
}

export type ValidationCategory = 'fast' | 'slow'

type ValidationCheckEntry = {
    check: ValidationCheck
    category: ValidationCategory
}

/**
 * Manages a set of `ValidationCheck`s to be applied when documents are validated.
 */
export class ValidationRegistry {
    private readonly entries = new MultiMap<string, ValidationCheckEntry>();
    private readonly reflection: AstReflection;

    constructor(services: LangiumServices) {
        this.reflection = services.shared.AstReflection;
    }

    /**
     * Register a set of validation checks. Each value in the record can be either a single validation check (i.e. a function)
     * or an array of validation checks.
     *
     * @param checksRecord Set of validation checks to register.
     * @param category Optional category for the validation checks (defaults to `'fast'`).
     * @param thisObj Optional object to be used as `this` when calling the validation check functions.
     */
    register<T>(checksRecord: ValidationChecks<T>, thisObj: ThisParameterType<unknown> = this, category: ValidationCategory = 'fast'): void {
        for (const [type, ch] of Object.entries(checksRecord)) {
            const callbacks = ch as ValidationCheck | ValidationCheck[];
            if (Array.isArray(callbacks)) {
                for (const check of callbacks) {
                    const entry: ValidationCheckEntry = {
                        check: this.wrapValidationException(check, thisObj),
                        category
                    };
                    this.addEntry(type, entry);
                }
            } else if (typeof callbacks === 'function') {
                const entry: ValidationCheckEntry = {
                    check: this.wrapValidationException(callbacks, thisObj),
                    category
                };
                this.addEntry(type, entry);
            }
        }
    }

    protected wrapValidationException(check: ValidationCheck, thisObj: unknown): ValidationCheck {
        return async (node, accept, cancelToken) => {
            try {
                await check.call(thisObj, node, accept, cancelToken);
            } catch (err) {
                if (isOperationCancelled(err)) {
                    throw err;
                }
                console.error('An error occurred during validation:', err);
                const message = err instanceof Error ? err.message : String(err);
                if (err instanceof Error && err.stack) {
                    console.error(err.stack);
                }
                accept('error', 'An error occurred during validation: ' + message, { node });
            }
        };
    }

    protected addEntry(type: string, entry: ValidationCheckEntry): void {
        if (type === 'AstNode') {
            this.entries.add('AstNode', entry);
            return;
        }
        for (const subtype of this.reflection.getAllSubTypes(type)) {
            this.entries.add(subtype, entry);
        }
    }

    getChecks(type: string, category?: ValidationCategory): Stream<ValidationCheck> {
        let checks = stream(this.entries.get(type))
            .concat(this.entries.get('AstNode'));
        if (category) {
            checks = checks.filter(entry => entry.category === category);
        }
        return checks.map(entry => entry.check);
    }

}
