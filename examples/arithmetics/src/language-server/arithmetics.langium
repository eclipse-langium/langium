grammar Arithmetics

entry Module:
    'module' name=ID
    (statements+=Statement)*;

interface A {
    name: string
    foo: string
}

interface B extends A {}

type C = A | B;

RuleA returns A: name=ID foo=ID;

RuleB returns B: name=ID foo=ID;

RuleC returns C: name=ID foo=ID;

Statement:
    Definition | Evaluation;

Definition:
    'def' name=ID ('(' args+=DeclaredParameter (',' args+=DeclaredParameter)* ')')?
    ':' expr=Expression ';';

DeclaredParameter:
    name=ID;

type AbstractDefinition = Definition | DeclaredParameter;

Evaluation:
    expression=Expression ';';

Expression:
    Addition;

Addition infers Expression:
    Multiplication ({infer BinaryExpression.left=current} operator=('+' | '-') right=Multiplication)*;

Multiplication infers Expression:
    PrimaryExpression ({infer BinaryExpression.left=current} operator=('*' | '/') right=PrimaryExpression)*;

PrimaryExpression infers Expression:
    '(' Expression ')' |
    {infer NumberLiteral} value=NUMBER |
    {infer FunctionCall} func=[AbstractDefinition] ('(' args+=Expression (',' args+=Expression)* ')')?;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal NUMBER returns number: /[0-9]+(\.[0-9])?/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
