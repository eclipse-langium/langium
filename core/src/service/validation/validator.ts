import { AstNode } from '../../generator/ast-node';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Validation = (node: any, validationAcceptor: ValidationAcceptor) => void;

export interface LangiumDiagnostic {
    node: AstNode,
    feature?: string,
    index?: number,
    severity: DiagnosticSeverity,
    message: string,
    code?: number | string
}

export class ValidationAcceptor {

    protected currentNode!: AstNode;
    protected validationItems: LangiumDiagnostic[] = [];

    error(message: string, feature?: string, item?: AstNode, code?: number | string, index?: number): void {
        this.addValidation(item, message, DiagnosticSeverity.Error, feature, code, index);
    }

    warning(message: string, feature?: string, item?: AstNode, code?: number | string, index?: number): void {
        this.addValidation(item, message, DiagnosticSeverity.Warning, feature, code, index);
    }

    information(message: string, feature?: string, item?: AstNode, code?: number | string, index?: number): void {
        this.addValidation(item, message, DiagnosticSeverity.Information, feature, code, index);
    }

    hint(message: string, feature?: string, item?: AstNode, code?: number | string, index?: number): void {
        this.addValidation(item, message, DiagnosticSeverity.Hint, feature, code, index);
    }

    protected addValidation(item: AstNode | undefined, message: string, severity: DiagnosticSeverity, feature?: string, code?: number | string, index?: number): void {
        this.validationItems.push({ node: item ?? this.currentNode, feature, severity, message, code, index });
        // TODO: Only items from the current document can be added in here
    }

}

interface ValidatorWithAstNode {
    readonly validationItems: LangiumDiagnostic[],
    currentNode: AstNode
}

export class Validator {

    private readonly validationMap = new Map<string, Validation[]>();

    register(type: string | string[], ...methods: Validation[]): void {
        let types: string[];
        if (Array.isArray(type)) {
            types = type;
        } else {
            types = [type];
        }
        for (const typeItem of types) {
            if (!this.validationMap.has(typeItem)) {
                this.validationMap.set(typeItem, []);
            }
            this.validationMap.get(typeItem)?.push(...methods);
        }
    }

    validate(node: AstNode): LangiumDiagnostic[] { // FIXME: Insert document here instead and iterate over the tree
        const acceptor = new ValidationAcceptor();
        const astNodeAcceptor = <ValidatorWithAstNode><unknown>acceptor;
        const validations = this.validationMap.get(node.$type);
        if (validations) {
            astNodeAcceptor.currentNode = node;
            for (const validation of validations) {
                validation(node, acceptor);
            }
        }
        return astNodeAcceptor.validationItems;
    }
}

export class CompositeValidator extends Validator {

    protected validators: Validator[] = [];

    initialize(validators: Validator[]): void {
        this.validators = [...validators];
    }

    validate(node: AstNode): LangiumDiagnostic[] {
        const validationItems: LangiumDiagnostic[] = [];
        for (const validator of this.validators) {
            validationItems.push(...validator.validate(node));
        }
        return validationItems;
    }
}
