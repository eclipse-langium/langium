/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken, CodeDescription, DiagnosticRelatedInformation, DiagnosticTag, integer, Range } from 'vscode-languageserver';
import type { LangiumServices } from '../services';
import type { AstNode, AstReflection, Properties } from '../syntax-tree';
import type { MaybePromise } from '../utils/promise-util';
import { MultiMap } from '../utils/collections';
import { isOperationCancelled } from '../utils/promise-util';

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

/**
 * Manages a set of `ValidationCheck`s to be applied when documents are validated.
 */
export class ValidationRegistry {
    private readonly validationChecks = new MultiMap<string, ValidationCheck>();
    private readonly reflection: AstReflection;

    constructor(services: LangiumServices) {
        this.reflection = services.shared.AstReflection;
    }

    register<T>(checksRecord: ValidationChecks<T>, thisObj: ThisParameterType<unknown> = this): void {
        for (const [type, ch] of Object.entries(checksRecord)) {
            const callbacks = ch as ValidationCheck | ValidationCheck[];
            if (Array.isArray(callbacks)) {
                for (const check of callbacks) {
                    this.doRegister(type, this.wrapValidationException(check, thisObj));
                }
            } else if (typeof callbacks === 'function') {
                this.doRegister(type, this.wrapValidationException(callbacks, thisObj));
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

    protected doRegister(type: string, check: ValidationCheck): void {
        if (type === 'AstNode') {
            this.validationChecks.add('AstNode', check);
            return;
        }
        for (const subtype of this.reflection.getAllSubTypes(type)) {
            this.validationChecks.add(subtype, check);
        }
    }

    getChecks(type: string): readonly ValidationCheck[] {
        return this.validationChecks.get(type).concat(this.validationChecks.get('AstNode'));
    }

}
