import { AstNode, Type } from '../generator/ast-node';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Validation = (node: any) => void;

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

export class Validator {

    private readonly validationMap = new Map<Type, Validation[]>();
    private validationItems: ValidationItem[] = [];

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
            this.validationMap.get(typeItem)?.push(...methods.map(e => e.bind(this)));
        }
    }

    validate(node: AstNode): ValidationItem[] { // FIXME: Insert document here instead and iterate over the tree
        this.validationItems = [];
        const validations = this.validationMap.get(node.$type);
        if (validations) {
            for (const validation of validations) {
                validation(node);
            }
        }
        return this.validationItems;
    }

    addValidation(item: AstNode, message: string, severity: ValidationSeverity, feature?: string, code?: number | string, index?: number): void {
        this.validationItems.push({ item, feature, severity, message, code, index });
        // TODO: Only items from the current document can be added in here
    }

    error(item: AstNode, message: string, feature?: string, code?: number | string, index?: number): void {
        this.addValidation(item, message, ValidationSeverity.Error, feature, code, index);
    }

    warning(item: AstNode, message: string, feature?: string, code?: number | string, index?: number): void {
        this.addValidation(item, message, ValidationSeverity.Warning, feature, code, index);
    }

    information(item: AstNode, message: string, feature?: string, code?: number | string, index?: number): void {
        this.addValidation(item, message, ValidationSeverity.Information, feature, code, index);
    }

    hint(item: AstNode, message: string, feature?: string, code?: number | string, index?: number): void {
        this.addValidation(item, message, ValidationSeverity.Hint, feature, code, index);
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