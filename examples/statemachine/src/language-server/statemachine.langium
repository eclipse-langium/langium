grammar Statemachine
hidden(WS, SL_COMMENT, ML_COMMENT)

Statemachine:
	'statemachine' name=ID
	('events' events+=Event+)?
	('commands'	commands+=Command+)?
	'initialState' init=[State]
	states+=State*;

Event:
	name=ID;

Command:
	name=ID;

State:
	'state' name=ID
		('actions' '{' actions+=[Command]+ '}')?
		transitions+=Transition*
	'end';

Transition:
	event=[Event] '=>' state=[State];

terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"[^"]*"|'[^']*'/;

terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
terminal SL_COMMENT: /\/\/[^\n\r]*/;
