grammar Arithmetics hidden(WS)

terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal NUMBER: /[0-9]+(\.[0-9])?/;


Module:
	'module' name=ID
	(statements+=Statement)*;

Statement:
	Definition | Evaluation;

Definition:
	'def' name=ID ('(' args+=DeclaredParameter (',' args+=DeclaredParameter)* ')')?
	':' expr=Expression ';';

DeclaredParameter:
	name=ID;

AbstractDefinition:
	Definition | DeclaredParameter;

Evaluation:
	expression=Expression ';';

Expression:
	Addition;

Addition returns Expression:
	Subtraction (({Addition.left=current} '+') right=Subtraction)*;

Subtraction returns Expression:
	Multiplication (({Subtraction.left=current} '-') right=Multiplication)*;

Multiplication returns Expression:
	Division (({Multiplication.left=current} '*') right=Division)*;

Division returns Expression:
	PrimaryExpression (({Division.left=current} '/') right=PrimaryExpression)*;

PrimaryExpression returns Expression:
	'(' Expression ')' | NumberLiteral | FunctionCall;

NumberLiteral returns Expression:
	{NumberLiteral} value=NUMBER;
	
FunctionCall returns Expression:
	{FunctionCall} func=[AbstractDefinition] ('(' args+=Expression (',' args+=Expression)* ')')?;
