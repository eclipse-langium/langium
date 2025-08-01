/******************************************************************************
 * This file was generated by langium-cli 4.0.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

/* eslint-disable */
import * as langium from 'langium';

export const ArithmeticsTerminals = {
    WS: /\s+/,
    ID: /[_a-zA-Z][\w_]*/,
    NUMBER: /[0-9]+(\.[0-9]*)?/,
    ML_COMMENT: /\/\*[\s\S]*?\*\//,
    SL_COMMENT: /\/\/[^\n\r]*/,
};

export type ArithmeticsTerminalNames = keyof typeof ArithmeticsTerminals;

export type ArithmeticsKeywordNames =
    | "%"
    | "("
    | ")"
    | "*"
    | "+"
    | ","
    | "-"
    | "/"
    | ":"
    | ";"
    | "^"
    | "def"
    | "module";

export type ArithmeticsTokenNames = ArithmeticsTerminalNames | ArithmeticsKeywordNames;

export type AbstractDefinition = DeclaredParameter | Definition;

export const AbstractDefinition = {
    $type: 'AbstractDefinition'
} as const;

export function isAbstractDefinition(item: unknown): item is AbstractDefinition {
    return reflection.isInstance(item, AbstractDefinition.$type);
}

export interface BinaryExpression extends langium.AstNode {
    readonly $container: BinaryExpression | Definition | Evaluation | FunctionCall;
    readonly $type: 'BinaryExpression';
    left: Expression;
    operator: '%' | '*' | '+' | '-' | '/' | '^';
    right: Expression;
}

export const BinaryExpression = {
    $type: 'BinaryExpression',
    left: 'left',
    operator: 'operator',
    right: 'right'
} as const;

export function isBinaryExpression(item: unknown): item is BinaryExpression {
    return reflection.isInstance(item, BinaryExpression.$type);
}

export interface DeclaredParameter extends langium.AstNode {
    readonly $container: Definition;
    readonly $type: 'DeclaredParameter';
    name: string;
}

export const DeclaredParameter = {
    $type: 'DeclaredParameter',
    name: 'name'
} as const;

export function isDeclaredParameter(item: unknown): item is DeclaredParameter {
    return reflection.isInstance(item, DeclaredParameter.$type);
}

export interface Definition extends langium.AstNode {
    readonly $container: Module;
    readonly $type: 'Definition';
    args: Array<DeclaredParameter>;
    expr: Expression;
    name: string;
}

export const Definition = {
    $type: 'Definition',
    args: 'args',
    expr: 'expr',
    name: 'name'
} as const;

export function isDefinition(item: unknown): item is Definition {
    return reflection.isInstance(item, Definition.$type);
}

export interface Evaluation extends langium.AstNode {
    readonly $container: Module;
    readonly $type: 'Evaluation';
    expression: Expression;
}

export const Evaluation = {
    $type: 'Evaluation',
    expression: 'expression'
} as const;

export function isEvaluation(item: unknown): item is Evaluation {
    return reflection.isInstance(item, Evaluation.$type);
}

export type Expression = BinaryExpression | FunctionCall | NumberLiteral;

export const Expression = {
    $type: 'Expression'
} as const;

export function isExpression(item: unknown): item is Expression {
    return reflection.isInstance(item, Expression.$type);
}

export interface FunctionCall extends langium.AstNode {
    readonly $container: BinaryExpression | Definition | Evaluation | FunctionCall;
    readonly $type: 'FunctionCall';
    args: Array<Expression>;
    func: langium.Reference<AbstractDefinition>;
}

export const FunctionCall = {
    $type: 'FunctionCall',
    args: 'args',
    func: 'func'
} as const;

export function isFunctionCall(item: unknown): item is FunctionCall {
    return reflection.isInstance(item, FunctionCall.$type);
}

export interface Module extends langium.AstNode {
    readonly $type: 'Module';
    name: string;
    statements: Array<Statement>;
}

export const Module = {
    $type: 'Module',
    name: 'name',
    statements: 'statements'
} as const;

export function isModule(item: unknown): item is Module {
    return reflection.isInstance(item, Module.$type);
}

export interface NumberLiteral extends langium.AstNode {
    readonly $container: BinaryExpression | Definition | Evaluation | FunctionCall;
    readonly $type: 'NumberLiteral';
    value: number;
}

export const NumberLiteral = {
    $type: 'NumberLiteral',
    value: 'value'
} as const;

export function isNumberLiteral(item: unknown): item is NumberLiteral {
    return reflection.isInstance(item, NumberLiteral.$type);
}

export type Statement = Definition | Evaluation;

export const Statement = {
    $type: 'Statement'
} as const;

export function isStatement(item: unknown): item is Statement {
    return reflection.isInstance(item, Statement.$type);
}

export type ArithmeticsAstType = {
    AbstractDefinition: AbstractDefinition
    BinaryExpression: BinaryExpression
    DeclaredParameter: DeclaredParameter
    Definition: Definition
    Evaluation: Evaluation
    Expression: Expression
    FunctionCall: FunctionCall
    Module: Module
    NumberLiteral: NumberLiteral
    Statement: Statement
}

export class ArithmeticsAstReflection extends langium.AbstractAstReflection {
    override readonly types = {
        AbstractDefinition: {
            name: AbstractDefinition.$type,
            properties: {
            },
            superTypes: []
        },
        BinaryExpression: {
            name: BinaryExpression.$type,
            properties: {
                left: {
                    name: BinaryExpression.left
                },
                operator: {
                    name: BinaryExpression.operator
                },
                right: {
                    name: BinaryExpression.right
                }
            },
            superTypes: [Expression.$type]
        },
        DeclaredParameter: {
            name: DeclaredParameter.$type,
            properties: {
                name: {
                    name: DeclaredParameter.name
                }
            },
            superTypes: [AbstractDefinition.$type]
        },
        Definition: {
            name: Definition.$type,
            properties: {
                args: {
                    name: Definition.args,
                    defaultValue: []
                },
                expr: {
                    name: Definition.expr
                },
                name: {
                    name: Definition.name
                }
            },
            superTypes: [AbstractDefinition.$type, Statement.$type]
        },
        Evaluation: {
            name: Evaluation.$type,
            properties: {
                expression: {
                    name: Evaluation.expression
                }
            },
            superTypes: [Statement.$type]
        },
        Expression: {
            name: Expression.$type,
            properties: {
            },
            superTypes: []
        },
        FunctionCall: {
            name: FunctionCall.$type,
            properties: {
                args: {
                    name: FunctionCall.args,
                    defaultValue: []
                },
                func: {
                    name: FunctionCall.func,
                    referenceType: AbstractDefinition.$type
                }
            },
            superTypes: [Expression.$type]
        },
        Module: {
            name: Module.$type,
            properties: {
                name: {
                    name: Module.name
                },
                statements: {
                    name: Module.statements,
                    defaultValue: []
                }
            },
            superTypes: []
        },
        NumberLiteral: {
            name: NumberLiteral.$type,
            properties: {
                value: {
                    name: NumberLiteral.value
                }
            },
            superTypes: [Expression.$type]
        },
        Statement: {
            name: Statement.$type,
            properties: {
            },
            superTypes: []
        }
    } as const satisfies langium.AstMetaData
}

export const reflection = new ArithmeticsAstReflection();
