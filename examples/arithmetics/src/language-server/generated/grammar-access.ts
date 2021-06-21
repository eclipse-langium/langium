import { Action, Assignment, CrossReference, Keyword, RuleCall, GrammarAccess } from 'langium';
import * as path from 'path';

export type ModuleRuleAccess = {
    ModuleKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
    imports: Assignment;
    importsImportRuleCall: RuleCall;
    statements: Assignment;
    statementsStatementRuleCall: RuleCall;
}

export type ImportRuleAccess = {
    ImportKeyword: Keyword;
    module: Assignment;
    moduleModuleCrossReference: CrossReference;
}

export type StatementRuleAccess = {
    DefinitionRuleCall: RuleCall;
    EvaluationRuleCall: RuleCall;
}

export type DefinitionRuleAccess = {
    DefKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
    ParenthesisOpenKeyword: Keyword;
    args: Assignment;
    argsDeclaredParameterRuleCall: RuleCall;
    CommaKeyword: Keyword;
    ParenthesisCloseKeyword: Keyword;
    ColonKeyword: Keyword;
    expr: Assignment;
    exprExpressionRuleCall: RuleCall;
    SemicolonKeyword: Keyword;
}

export type DeclaredParameterRuleAccess = {
    name: Assignment;
    nameIDRuleCall: RuleCall;
}

export type AbstractDefinitionRuleAccess = {
    DefinitionRuleCall: RuleCall;
    DeclaredParameterRuleCall: RuleCall;
}

export type EvaluationRuleAccess = {
    expression: Assignment;
    expressionExpressionRuleCall: RuleCall;
    SemicolonKeyword: Keyword;
}

export type ExpressionRuleAccess = {
    AdditionRuleCall: RuleCall;
}

export type AdditionRuleAccess = {
    SubtractionRuleCall: RuleCall;
    AdditionleftAction: Action;
    PlusKeyword: Keyword;
    right: Assignment;
    rightSubtractionRuleCall: RuleCall;
}

export type SubtractionRuleAccess = {
    MultiplicationRuleCall: RuleCall;
    SubtractionleftAction: Action;
    DashKeyword: Keyword;
    right: Assignment;
    rightMultiplicationRuleCall: RuleCall;
}

export type MultiplicationRuleAccess = {
    DivisionRuleCall: RuleCall;
    MultiplicationleftAction: Action;
    AsteriskKeyword: Keyword;
    right: Assignment;
    rightDivisionRuleCall: RuleCall;
}

export type DivisionRuleAccess = {
    PrimaryExpressionRuleCall: RuleCall;
    DivisionleftAction: Action;
    ExclamationMarkKeyword: Keyword;
    right: Assignment;
    rightPrimaryExpressionRuleCall: RuleCall;
}

export type PrimaryExpressionRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    ExpressionRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
    NumRuleCall: RuleCall;
    FuncCallRuleCall: RuleCall;
}

export type NumRuleAccess = {
    NumAction: Action;
    value: Assignment;
    valueNUMBERRuleCall: RuleCall;
}

export type FuncCallRuleAccess = {
    FuncCallAction: Action;
    func: Assignment;
    funcAbstractDefinitionCrossReference: CrossReference;
    ParenthesisOpenKeyword: Keyword;
    args: Assignment;
    argsExpressionRuleCall: RuleCall;
    CommaKeyword: Keyword;
    ParenthesisCloseKeyword: Keyword;
}

export class ArithmeticsGrammarAccess extends GrammarAccess {
    Module = this.buildAccess<ModuleRuleAccess>('Module');
    Import = this.buildAccess<ImportRuleAccess>('Import');
    Statement = this.buildAccess<StatementRuleAccess>('Statement');
    Definition = this.buildAccess<DefinitionRuleAccess>('Definition');
    DeclaredParameter = this.buildAccess<DeclaredParameterRuleAccess>('DeclaredParameter');
    AbstractDefinition = this.buildAccess<AbstractDefinitionRuleAccess>('AbstractDefinition');
    Evaluation = this.buildAccess<EvaluationRuleAccess>('Evaluation');
    Expression = this.buildAccess<ExpressionRuleAccess>('Expression');
    Addition = this.buildAccess<AdditionRuleAccess>('Addition');
    Subtraction = this.buildAccess<SubtractionRuleAccess>('Subtraction');
    Multiplication = this.buildAccess<MultiplicationRuleAccess>('Multiplication');
    Division = this.buildAccess<DivisionRuleAccess>('Division');
    PrimaryExpression = this.buildAccess<PrimaryExpressionRuleAccess>('PrimaryExpression');
    Num = this.buildAccess<NumRuleAccess>('Num');
    FuncCall = this.buildAccess<FuncCallRuleAccess>('FuncCall');

    constructor() {
        super(path.join(__dirname, 'grammar.json'));
    }
}
