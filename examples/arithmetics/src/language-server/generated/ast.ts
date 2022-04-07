/******************************************************************************
 * This file was generated by langium-cli 0.3.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-empty-interface */
import { AstNode, AstReflection, Reference, isAstNode, TypeMetaData } from 'langium';

export type AbstractDefinition = DeclaredParameter | Definition;

export const AbstractDefinition = 'AbstractDefinition';

export function isAbstractDefinition(item: unknown): item is AbstractDefinition {
    return reflection.isInstance(item, AbstractDefinition);
}

export type Expression = BinaryExpression | FunctionCall | NumberLiteral;

export const Expression = 'Expression';

export function isExpression(item: unknown): item is Expression {
    return reflection.isInstance(item, Expression);
}

export type Statement = Definition | Evaluation;

export const Statement = 'Statement';

export function isStatement(item: unknown): item is Statement {
    return reflection.isInstance(item, Statement);
}

export interface BinaryExpression extends AstNode {
    readonly $container: BinaryExpression | Definition | Evaluation | FunctionCall;
    left: Expression
    operator: '*' | '/' | '+' | '-'
    right: Expression
}

export const BinaryExpression = 'BinaryExpression';

export function isBinaryExpression(item: unknown): item is BinaryExpression {
    return reflection.isInstance(item, BinaryExpression);
}

export interface DeclaredParameter extends AstNode {
    readonly $container: Definition;
    name: string
}

export const DeclaredParameter = 'DeclaredParameter';

export function isDeclaredParameter(item: unknown): item is DeclaredParameter {
    return reflection.isInstance(item, DeclaredParameter);
}

export interface Definition extends AstNode {
    readonly $container: Module;
    args: Array<DeclaredParameter>
    expr: Expression
    name: string
}

export const Definition = 'Definition';

export function isDefinition(item: unknown): item is Definition {
    return reflection.isInstance(item, Definition);
}

export interface Evaluation extends AstNode {
    readonly $container: Module;
    expression: Expression
}

export const Evaluation = 'Evaluation';

export function isEvaluation(item: unknown): item is Evaluation {
    return reflection.isInstance(item, Evaluation);
}

export interface FunctionCall extends AstNode {
    readonly $container: BinaryExpression | Definition | Evaluation | FunctionCall;
    args: Array<Expression>
    func: Reference<AbstractDefinition>
}

export const FunctionCall = 'FunctionCall';

export function isFunctionCall(item: unknown): item is FunctionCall {
    return reflection.isInstance(item, FunctionCall);
}

export interface Module extends AstNode {
    name: string
    statements: Array<Statement>
}

export const Module = 'Module';

export function isModule(item: unknown): item is Module {
    return reflection.isInstance(item, Module);
}

export interface NumberLiteral extends AstNode {
    readonly $container: BinaryExpression | Definition | Evaluation | FunctionCall;
    value: number
}

export const NumberLiteral = 'NumberLiteral';

export function isNumberLiteral(item: unknown): item is NumberLiteral {
    return reflection.isInstance(item, NumberLiteral);
}

export type ArithmeticsAstType = 'AbstractDefinition' | 'BinaryExpression' | 'DeclaredParameter' | 'Definition' | 'Evaluation' | 'Expression' | 'FunctionCall' | 'Module' | 'NumberLiteral' | 'Statement';

export type ArithmeticsAstReference = 'FunctionCall:func';

export class ArithmeticsAstReflection implements AstReflection {

    getAllTypes(): string[] {
        return ['AbstractDefinition', 'BinaryExpression', 'DeclaredParameter', 'Definition', 'Evaluation', 'Expression', 'FunctionCall', 'Module', 'NumberLiteral', 'Statement'];
    }

    isInstance(node: unknown, type: string): boolean {
        return isAstNode(node) && this.isSubtype(node.$type, type);
    }

    isSubtype(subtype: string, supertype: string): boolean {
        if (subtype === supertype) {
            return true;
        }
        switch (subtype) {
            case BinaryExpression:
            case FunctionCall:
            case NumberLiteral: {
                return this.isSubtype(Expression, supertype);
            }
            case DeclaredParameter: {
                return this.isSubtype(AbstractDefinition, supertype);
            }
            case Definition: {
                return this.isSubtype(Statement, supertype) || this.isSubtype(AbstractDefinition, supertype);
            }
            case Evaluation: {
                return this.isSubtype(Statement, supertype);
            }
            default: {
                return false;
            }
        }
    }

    getReferenceType(referenceId: ArithmeticsAstReference): string {
        switch (referenceId) {
            case 'FunctionCall:func': {
                return AbstractDefinition;
            }
            default: {
                throw new Error(`${referenceId} is not a valid reference id.`);
            }
        }
    }

    getTypeMetaData(type: string): TypeMetaData {
        switch (type) {
            case 'Definition': {
                return {
                    name: 'Definition',
                    mandatory: [
                        { name: 'args', type: 'array' }
                    ]
                };
            }
            case 'FunctionCall': {
                return {
                    name: 'FunctionCall',
                    mandatory: [
                        { name: 'args', type: 'array' }
                    ]
                };
            }
            case 'Module': {
                return {
                    name: 'Module',
                    mandatory: [
                        { name: 'statements', type: 'array' }
                    ]
                };
            }
            default: {
                return {
                    name: type,
                    mandatory: []
                };
            }
        }
    }
}

export const reflection = new ArithmeticsAstReflection();
