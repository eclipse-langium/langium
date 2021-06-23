grammar Arithmetics hidden(WS)

terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal NUMBER: /[0-9]+(\.[0-9])?/;


Module:
	'module' name=ID
	(imports+=Import)*
	(statements+=Statement)*;

Import:
	'import' module=[Module];

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
	Multiplication (({Addition.left=current} '+' | {Subtraction.left=current} '-') right=Multiplication)*;

Multiplication returns Expression:
	PrimaryExpression (({Multiplication.left=current} '*' | {Division.left=current} '/') right=PrimaryExpression)*;

PrimaryExpression returns Expression:
	'(' Expression ')' |
	{NumberLiteral} value=NUMBER |
	{FunctionCall} func=[AbstractDefinition] ('(' args+=Expression (',' args+=Expression)* ')')?;
