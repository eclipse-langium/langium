import { AstNode, Type } from '../generator/ast-node';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Validation = (node: any, validationAcceptor: ValidationAcceptor) => void;

export interface ValidationItem {
    item: AstNode,
    feature?: string,
    index?: number,
    severity: ValidationSeverity,
    message: string,
    code?: number | string
}

export enum ValidationSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}

export class ValidationAcceptor {

    protected currentNode!: AstNode;
    protected validationItems: ValidationItem[] = [];

    error(message: string, feature?: string, item?: AstNode, code?: number | string, index?: number): void {
        this.addValidation(item, message, ValidationSeverity.Error, feature, code, index);
    }

    warning(message: string, feature?: string, item?: AstNode, code?: number | string, index?: number): void {
        this.addValidation(item, message, ValidationSeverity.Warning, feature, code, index);
    }

    information(message: string, feature?: string, item?: AstNode, code?: number | string, index?: number): void {
        this.addValidation(item, message, ValidationSeverity.Information, feature, code, index);
    }

    hint(message: string, feature?: string, item?: AstNode, code?: number | string, index?: number): void {
        this.addValidation(item, message, ValidationSeverity.Hint, feature, code, index);
    }

    protected addValidation(item: AstNode | undefined, message: string, severity: ValidationSeverity, feature?: string, code?: number | string, index?: number): void {
        this.validationItems.push({ item: item ?? this.currentNode, feature, severity, message, code, index });
        // TODO: Only items from the current document can be added in here
    }

}

interface ValidatorWithAstNode {
    readonly validationItems: ValidationItem[],
    currentNode: AstNode
}

export class Validator {

    private readonly validationMap = new Map<Type, Validation[]>();

    register(type: Type | Type[], ...methods: Validation[]): void {
        let types: Type[];
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

    validate(node: AstNode): ValidationItem[] { // FIXME: Insert document here instead and iterate over the tree
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

    validate(node: AstNode): ValidationItem[] {
        const validationItems: ValidationItem[] = [];
        for (const validator of this.validators) {
            validationItems.push(...validator.validate(node));
        }
        return validationItems;
    }
}