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
	(rules+=AbstractRule | interfaces+=Interface | types+=Type)+;

Interface:
	'interface' name=ID
	('extends' superTypes+=[AbstractType] (',' superTypes+=[AbstractType])*)?
	SchemaType;

fragment SchemaType:
	'{' attributes+=TypeAttribute* '}' ';'?;

TypeAttribute:
	name=ID (isOptional?='?')? ':' type=AtomType ';'?;

Type:
	'type' name=ID '=' typeAlternatives+=AtomType ('|' typeAlternatives+=AtomType)* ';'?;

AtomType:
		(	primitiveType=PrimitiveType
		| 	isRef?='@'? refType=[AbstractType]
		) isArray?='[]'?
	|	keywordType=Keyword;

type AbstractType = Interface | Type | ParserRule;

PrimitiveType returns string:
	'string' | 'number' | 'boolean' | 'date';

ReturnType:
	name=(PrimitiveType | ID);

AbstractRule : ParserRule | TerminalRule;

GrammarImport:
	'import' path=STRING ';';

ParserRule:
	(entry?='entry' | fragment?='fragment')? RuleNameAndParams (wildcard?='*' | 'returns' type=ReturnType | infer?='infer' type=ReturnType)?
	(definesHiddenTokens?='hidden' '(' (hiddenTokens+=[AbstractRule:ID] (',' hiddenTokens+=[AbstractRule:ID])*)? ')')? ':'
		alternatives=Alternatives
	';';

fragment RuleNameAndParams:
	name=ID ('<' (parameters+=Parameter (',' parameters+=Parameter)*)? '>')?;

Parameter:
	name=ID;

Alternatives infer AbstractElement:
	ConditionalBranch ({infer Alternatives.elements+=current} ('|' elements+=ConditionalBranch)+)?;

ConditionalBranch infer AbstractElement:
	  UnorderedGroup
	| {infer Group} '<' guardCondition=Disjunction '>' (elements+=AbstractToken)+
;

UnorderedGroup infer AbstractElement:
	Group ({infer UnorderedGroup.elements+=current} ('&' elements+=Group)+)?;

Group infer AbstractElement:
	AbstractToken ({infer Group.elements+=current} elements+=AbstractToken+)?;

AbstractToken infer AbstractElement:
	AbstractTokenWithCardinality |
	Action;

AbstractTokenWithCardinality infer AbstractElement:
	(Assignment | AbstractTerminal) cardinality=('?'|'*'|'+')?;

Action infer AbstractElement:
	{infer Action} '{' infer?='infer'? type=ID ('.' feature=FeatureName operator=('='|'+=') 'current')? '}';

AbstractTerminal infer AbstractElement:
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
	true?='true' | 'false';

Disjunction infer Condition:
	Conjunction ({infer Disjunction.left=current} '|' right=Conjunction)*;

Conjunction infer Condition:
	Negation ({infer Conjunction.left=current} '&' right=Negation)*;

Negation infer Condition:
	Atom | {infer Negation} '!' value=Negation;

Atom infer Condition:
	ParameterReference | ParenthesizedCondition | LiteralCondition;

ParenthesizedCondition infer Condition:
	'(' Disjunction ')';

ParameterReference:
	parameter=[Parameter:ID];

PredicatedKeyword infer Keyword:
	(predicated?='=>' | firstSetPredicated?='->') value=STRING;

PredicatedRuleCall infer RuleCall:
	(predicated?='=>' | firstSetPredicated?='->') rule=[AbstractRule:ID] ('<' arguments+=NamedArgument (',' arguments+=NamedArgument)* '>')?;

Assignment infer AbstractElement:
	{infer Assignment} (predicated?='=>' | firstSetPredicated?='->')? feature=FeatureName operator=('+='|'='|'?=') terminal=AssignableTerminal;

AssignableTerminal infer AbstractElement:
	Keyword | RuleCall | ParenthesizedAssignableElement | CrossReference;

ParenthesizedAssignableElement infer AbstractElement:
	'(' AssignableAlternatives ')';

AssignableAlternatives infer AbstractElement:
	AssignableTerminal ({infer Alternatives.elements+=current} ('|' elements+=AssignableTerminal)+)?;

CrossReference infer AbstractElement:
	{infer CrossReference} '[' type=[AbstractType] ((deprecatedSyntax?='|' | ':') terminal=CrossReferenceableTerminal )? ']';

CrossReferenceableTerminal infer AbstractElement:
	Keyword | RuleCall;

ParenthesizedElement infer AbstractElement:
	'(' Alternatives ')';

PredicatedGroup infer Group:
	(predicated?='=>' | firstSetPredicated?='->') '(' elements+=Alternatives ')';

TerminalRule:
	hidden?='hidden'? 'terminal' (fragment?='fragment' name=ID | name=ID ('returns' type=ReturnType)?) ':'
		terminal=TerminalAlternatives
	';';

terminal RegexLiteral returns string: /\/(?![*+?])(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\//;

TerminalAlternatives infer AbstractElement:
	TerminalGroup ({infer TerminalAlternatives.elements+=current} '|' elements+=TerminalGroup)*;

TerminalGroup infer AbstractElement:
	TerminalToken ({infer TerminalGroup.elements+=current} elements+=TerminalToken+)?;

TerminalToken infer AbstractElement:
	TerminalTokenElement cardinality=('?'|'*'|'+')?;

TerminalTokenElement infer AbstractElement:
	CharacterRange | TerminalRuleCall | ParenthesizedTerminalElement | NegatedToken | UntilToken | RegexToken | Wildcard;

ParenthesizedTerminalElement infer AbstractElement:
	'(' TerminalAlternatives ')';

TerminalRuleCall infer AbstractElement:
	{infer TerminalRuleCall} rule=[TerminalRule:ID];

NegatedToken infer AbstractElement:
	{infer NegatedToken} '!' terminal=TerminalTokenElement;

UntilToken infer AbstractElement:
	{infer UntilToken} '->' terminal=TerminalTokenElement;

RegexToken infer AbstractElement:
	{infer RegexToken} regex=RegexLiteral;

Wildcard infer AbstractElement:
	{infer Wildcard} '.';

CharacterRange infer AbstractElement:
	{infer CharacterRange} left=Keyword ('..' right=Keyword)?;

FeatureName returns string:
	'current' | 'entry' | 'extends' | 'false' | 'fragment' | 'grammar' | 'hidden' | 'import' | 'interface' | 'returns' | 'terminal' | 'true' | 'type' | 'infer' | 'with' | PrimitiveType | ID;

terminal ID: /\^?[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
