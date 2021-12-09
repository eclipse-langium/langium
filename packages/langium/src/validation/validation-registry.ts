/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, CodeDescription, DiagnosticRelatedInformation, DiagnosticTag, integer, Range } from 'vscode-languageserver';
import { LangiumServices } from '../services';
import { AstNode, AstReflection, Properties } from '../syntax-tree';
import { MaybePromise } from '../utils/promise-util';

export type DiagnosticInfo<N extends AstNode, P = Properties<N>> = {
    /** The AST node to which the diagnostic is attached. */
    node: N,
    /** If a property name is given, the diagnostic is resticted to the corresponding text region. */
    property?: P,
    /** In case of a multi-value property (array), an index can be given to select a specific element. */
    index?: number,
    /** If you want to create a diagnostic independent to any property, use the range property. */
    range?: Range,
    /** The diagnostic's code, which usually appear in the user interface. */
    code?: integer | string,
    /** An optional property to describe the error code. */
    codeDescription?: CodeDescription,
    /** Additional metadata about the diagnostic. */
    tags?: DiagnosticTag[];
    /** An array of related diagnostic information, e.g. when symbol-names within a scope collide all definitions can be marked via this property. */
    relatedInformation?: DiagnosticRelatedInformation[];
    /** A data entry field that is preserved between a `textDocument/publishDiagnostics` notification and `textDocument/codeAction` request. */
    data?: unknown;
}

export type ValidationAcceptor = <N extends AstNode>(severity: 'error' | 'warning' | 'info' | 'hint', message: string, info: DiagnosticInfo<N>) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidationCheck = (node: any, accept: ValidationAcceptor, cancelToken: CancellationToken) => MaybePromise<void>;

export class ValidationRegistry {
    private readonly validationChecks = new Map<string, ValidationCheck[]>();
    private readonly reflection: AstReflection;

    constructor(services: LangiumServices) {
        this.reflection = services.shared.AstReflection;
    }

    register(checksRecord: { [type: string]: ValidationCheck | ValidationCheck[] | undefined }, thisObj: ThisParameterType<unknown> = this): void {
        for (const [type, ch] of Object.entries(checksRecord)) {
            if (Array.isArray(ch)) {
                for (const check of ch) {
                    this.doRegister(type, this.wrapValidationException(check, thisObj));
                }
            } else if (ch) {
                this.doRegister(type, this.wrapValidationException(ch, thisObj));
            }
        }
    }

    protected wrapValidationException(check: ValidationCheck, thisObj: unknown): ValidationCheck {
        return (node, accept, cancelToken) => {
            try {
                check.call(thisObj, node, accept, cancelToken);
            } catch (e) {
                console.error('An exception occured executing a validation.', e);
            }
        };
    }

    protected doRegister(type: string, check: ValidationCheck): void {
        for (const subtype of this.reflection.getAllTypes()) {
            if (this.reflection.isSubtype(subtype, type)) {
                let checkArray = this.validationChecks.get(subtype);
                if (!checkArray) {
                    checkArray = [];
                    this.validationChecks.set(subtype, checkArray);
                }
                checkArray.push(check);
            }
        }
    }

    getChecks(type: string): ValidationCheck[] {
        return this.validationChecks.get(type) ?? [];
    }

}
