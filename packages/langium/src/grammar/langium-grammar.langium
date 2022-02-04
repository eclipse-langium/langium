/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
grammar LangiumGrammar

entry Grammar:
	(
        isDeclared?='grammar' name=ID ('with' usedGrammars+=[Grammar:ID] (',' usedGrammars+=[Grammar:ID])*)?
        (definesHiddenTokens?='hidden' '(' (hiddenTokens+=[AbstractRule:ID] (',' hiddenTokens+=[AbstractRule:ID])*)? ')')?
    )?
	imports+=GrammarImport*
	(rules+=AbstractRule | types+=TypeDeclaration)+;

///////////////////////////////////////////////////////////////////////////////

TypeDeclaration:
	Interface;

Interface:
	'interface' name=ID
	// superType can be Interface, not primitive return type or ParserRule without return name
	('extends' superTypes+=ID (',' superTypes+=ID)*)?
	SchemaType;

fragment SchemaType:
	'{' attributes+=TypeAttribute* '}' ';'?;

TypeAttribute:
	// type can be a primitive type, Interface, not primitive return type or ParserRule without return name 
	name=ID (isOptional?='?')? ':' type=ID ';'?;

// return type for terminals and datatype rules can be a primitive type
// return type for parser rules can be Interface, ParserRule or any ID (what is condidered as type definition)

///////////////////////////////////////////////////////////////////////////////

AbstractRule : ParserRule | TerminalRule;

GrammarImport:
	'import' path=STRING ';';

ParserRule :
	(
	  (^entry?='entry' | ^fragment?='fragment') RuleNameAndParams (wildcard?='*' | ('returns' type=ID)?)
	| RuleNameAndParams ('returns' type=ID)?
	)
	(definesHiddenTokens?='hidden' '(' (hiddenTokens+=[AbstractRule:ID] (',' hiddenTokens+=[AbstractRule:ID])*)? ')')? ':'
		alternatives=Alternatives
	';';

fragment RuleNameAndParams:
	name=ID ('<' (parameters+=Parameter (',' parameters+=Parameter)*)? '>')?;

Parameter:
	name=ID;

Alternatives returns AbstractElement:
	ConditionalBranch ({Alternatives.elements+=current} ('|' elements+=ConditionalBranch)+)?;

ConditionalBranch returns AbstractElement:
	  UnorderedGroup
	| {Group} '<' guardCondition=Disjunction '>' (elements+=AbstractToken)+
;

UnorderedGroup returns AbstractElement:
	Group ({UnorderedGroup.elements+=current} ('&' elements+=Group)+)?;

Group returns AbstractElement:
	AbstractToken ({Group.elements+=current} elements+=AbstractToken+)?;

AbstractToken returns AbstractElement:
	AbstractTokenWithCardinality |
	Action;

AbstractTokenWithCardinality returns AbstractElement:
	(Assignment | AbstractTerminal) cardinality=('?'|'*'|'+')?;

Action returns AbstractElement:
	{Action} '{' type=ID ('.' feature=ID operator=('='|'+=') 'current')? '}';

AbstractTerminal returns AbstractElement:
	Keyword |
	RuleCall |
	ParenthesizedElement |
	PredicatedKeyword |
	PredicatedRuleCall |
	PredicatedGroup;

Keyword:
	value=STRING;

RuleCall:
	rule=[AbstractRule:ID] ('<' arguments+=NamedArgument (',' arguments+=NamedArgument)* '>')?;

NamedArgument:
	( parameter=[Parameter:ID] calledByName?= '=')?
	( value=Disjunction );

LiteralCondition:
	^true?='true' | 'false';

Disjunction returns Condition:
	Conjunction ({Disjunction.left=current} '|' right=Conjunction)*;

Conjunction returns Condition:
	Negation ({Conjunction.left=current} '&' right=Negation)*;

Negation returns Condition:
	Atom | {Negation} '!' value=Negation;

Atom returns Condition:
	ParameterReference | ParenthesizedCondition | LiteralCondition;

ParenthesizedCondition returns Condition:
	'(' Disjunction ')';

ParameterReference:
	parameter=[Parameter:ID];

PredicatedKeyword returns Keyword:
	(predicated?='=>' | firstSetPredicated?='->') value=STRING;

PredicatedRuleCall returns RuleCall:
	(predicated?='=>' | firstSetPredicated?='->') rule=[AbstractRule:ID] ('<' arguments+=NamedArgument (',' arguments+=NamedArgument)* '>')?;

Assignment returns AbstractElement:
	{Assignment} (predicated?='=>' | firstSetPredicated?='->')? feature=ID operator=('+='|'='|'?=') ^terminal=AssignableTerminal;

AssignableTerminal returns AbstractElement:
	Keyword | RuleCall | ParenthesizedAssignableElement | CrossReference;

ParenthesizedAssignableElement returns AbstractElement:
	'(' AssignableAlternatives ')';

AssignableAlternatives returns AbstractElement:
	AssignableTerminal ({Alternatives.elements+=current} ('|' elements+=AssignableTerminal)+)?;

CrossReference returns AbstractElement:
	{CrossReference} '[' type=[ParserRule:ID] ((deprecatedSyntax?='|' | ':') ^terminal=CrossReferenceableTerminal )? ']';

CrossReferenceableTerminal returns AbstractElement:
	Keyword | RuleCall;

ParenthesizedElement returns AbstractElement:
	'(' Alternatives ')';

PredicatedGroup returns Group:
	(predicated?='=>' | firstSetPredicated?='->') '(' elements+=Alternatives ')';

TerminalRule:
	^hidden?='hidden'? 'terminal' (^fragment?='fragment' name=ID | name=ID ('returns' type=ID)?) ':'
		^terminal=TerminalAlternatives
	';';

terminal RegexLiteral returns string: /\/(?![*+?])(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\//;

TerminalAlternatives returns AbstractElement:
	TerminalGroup ({TerminalAlternatives.elements+=current} '|' elements+=TerminalGroup)*;

TerminalGroup returns AbstractElement:
	TerminalToken ({TerminalGroup.elements+=current} elements+=TerminalToken+)?;

TerminalToken returns AbstractElement:
	TerminalTokenElement cardinality=('?'|'*'|'+')?;

TerminalTokenElement returns AbstractElement:
	CharacterRange | TerminalRuleCall | ParenthesizedTerminalElement | NegatedToken | UntilToken | RegexToken | Wildcard;

ParenthesizedTerminalElement returns AbstractElement:
	'(' TerminalAlternatives ')';

TerminalRuleCall returns AbstractElement:
	{TerminalRuleCall} rule=[TerminalRule:ID];

NegatedToken returns AbstractElement:
	{NegatedToken} '!' ^terminal=TerminalTokenElement;

UntilToken returns AbstractElement:
	{UntilToken} '->' ^terminal=TerminalTokenElement;

RegexToken returns AbstractElement:
	{RegexToken} regex=RegexLiteral;

Wildcard returns AbstractElement:
	{Wildcard} '.';

CharacterRange returns AbstractElement:
	{CharacterRange} left=Keyword ('..' right=Keyword)?;

terminal ID: /\^?[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
