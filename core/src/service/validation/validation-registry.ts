import { CodeDescription, DiagnosticRelatedInformation, DiagnosticTag, integer } from 'vscode-languageserver/node';
import { AstNode, Properties } from '../../generator/ast-node';
import { LangiumServices } from '../../services';
import { AstReflection } from '../../generator/ast-node';

export type DiagnosticInfo<N extends AstNode> = {
    /** The AST node to which the diagnostic is attached. */
    node: N,
    /** If a property name is given, the diagnostic is resticted to the corresponding text region. */
    property?: Properties<N>,
    /** In case of a multi-value property (array), an index can be given to select a specific element. */
    index?: number,
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
export type ValidationCheck = (node: any, accept: ValidationAcceptor) => void;

export class ValidationRegistry {
    private readonly validationChecks = new Map<string, ValidationCheck[]>();
    private readonly reflection: AstReflection;

    constructor(services: LangiumServices) {
        this.reflection = services.AstReflection;
    }

    register(checksRecord: { [type: string]: ValidationCheck | ValidationCheck[] }, thisObj: ThisParameterType<unknown> = this): void {
        for (const [type, ch] of Object.entries(checksRecord)) {
            if (Array.isArray(ch)) {
                for (const check of ch) {
                    this.doRegister(type, check.bind(thisObj));
                }
            } else {
                this.doRegister(type, ch.bind(thisObj));
            }
        }
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
