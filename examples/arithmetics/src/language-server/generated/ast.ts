/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-empty-interface */
import { AstNode, AstReflection, Reference, isAstNode } from 'langium';

export interface AbstractDefinition extends AstNode {
    name: string
}

export const AbstractDefinition = 'AbstractDefinition';

export function isAbstractDefinition(item: unknown): item is AbstractDefinition {
    return reflection.isInstance(item, AbstractDefinition);
}

export interface Expression extends AstNode {
}

export const Expression = 'Expression';

export function isExpression(item: unknown): item is Expression {
    return reflection.isInstance(item, Expression);
}

export interface Import extends AstNode {
    module: Reference<Module>
}

export const Import = 'Import';

export function isImport(item: unknown): item is Import {
    return reflection.isInstance(item, Import);
}

export interface Module extends AstNode {
    name: string
    imports: Array<Import>
    statements: Array<Statement>
}

export const Module = 'Module';

export function isModule(item: unknown): item is Module {
    return reflection.isInstance(item, Module);
}

export interface Statement extends AstNode {
}

export const Statement = 'Statement';

export function isStatement(item: unknown): item is Statement {
    return reflection.isInstance(item, Statement);
}

export interface DeclaredParameter extends AbstractDefinition {
}

export const DeclaredParameter = 'DeclaredParameter';

export function isDeclaredParameter(item: unknown): item is DeclaredParameter {
    return reflection.isInstance(item, DeclaredParameter);
}

export interface Addition extends Expression {
    left: Expression
    right: Expression
}

export const Addition = 'Addition';

export function isAddition(item: unknown): item is Addition {
    return reflection.isInstance(item, Addition);
}

export interface Division extends Expression {
    left: Expression
    right: Expression
}

export const Division = 'Division';

export function isDivision(item: unknown): item is Division {
    return reflection.isInstance(item, Division);
}

export interface FuncCall extends Expression {
    func: Reference<AbstractDefinition>
    args: Array<Expression>
}

export const FuncCall = 'FuncCall';

export function isFuncCall(item: unknown): item is FuncCall {
    return reflection.isInstance(item, FuncCall);
}

export interface Multiplication extends Expression {
    left: Expression
    right: Expression
}

export const Multiplication = 'Multiplication';

export function isMultiplication(item: unknown): item is Multiplication {
    return reflection.isInstance(item, Multiplication);
}

export interface Num extends Expression {
    value: string
}

export const Num = 'Num';

export function isNum(item: unknown): item is Num {
    return reflection.isInstance(item, Num);
}

export interface Subtraction extends Expression {
    left: Expression
    right: Expression
}

export const Subtraction = 'Subtraction';

export function isSubtraction(item: unknown): item is Subtraction {
    return reflection.isInstance(item, Subtraction);
}

export interface Definition extends Statement, AbstractDefinition {
    args: Array<DeclaredParameter>
    expr: Expression
}

export const Definition = 'Definition';

export function isDefinition(item: unknown): item is Definition {
    return reflection.isInstance(item, Definition);
}

export interface Evaluation extends Statement {
    expression: Expression
}

export const Evaluation = 'Evaluation';

export function isEvaluation(item: unknown): item is Evaluation {
    return reflection.isInstance(item, Evaluation);
}

export type ArithmeticsAstType = 'AbstractDefinition' | 'Expression' | 'Import' | 'Module' | 'Statement' | 'DeclaredParameter' | 'Definition' | 'Addition' | 'Division' | 'FuncCall' | 'Multiplication' | 'Num' | 'Subtraction' | 'Definition' | 'Evaluation';

export type ArithmeticsAstReference = 'Import:module' | 'FuncCall:func';

export class ArithmeticsAstReflection implements AstReflection {

    getAllTypes(): string[] {
        return ['AbstractDefinition', 'Expression', 'Import', 'Module', 'Statement', 'DeclaredParameter', 'Definition', 'Addition', 'Division', 'FuncCall', 'Multiplication', 'Num', 'Subtraction', 'Definition', 'Evaluation'];
    }

    isInstance(node: unknown, type: string): boolean {
        return isAstNode(node) && this.isSubtype(node.$type, type);
    }

    isSubtype(subtype: string, supertype: string): boolean {
        if (subtype === supertype) {
            return true;
        }
        switch (subtype) {
            case DeclaredParameter: {
                return this.isSubtype(AbstractDefinition, supertype);
            }
            case Definition:
            case Definition: {
                return this.isSubtype(Statement, supertype) || this.isSubtype(AbstractDefinition, supertype);
            }
            case Addition:
            case Division:
            case FuncCall:
            case Multiplication:
            case Num:
            case Subtraction: {
                return this.isSubtype(Expression, supertype);
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
            case 'Import:module': {
                return Module;
            }
            case 'FuncCall:func': {
                return AbstractDefinition;
            }
            default: {
                throw new Error(`${referenceId} is not a valid reference id.`);
            }
        }
    }
}

export const reflection = new ArithmeticsAstReflection();
