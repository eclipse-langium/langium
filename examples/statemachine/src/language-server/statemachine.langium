grammar Statemachine
hidden(WS, SL_COMMENT, ML_COMMENT)

Statemachine :
	{Statemachine}
	('events' events+=Event+ 'end')?
	('resetEvents' resetEvents+=[Event]+ 'end')?
	('commands'	commands+=Command+ 'end')?
	states+=State*;

Event:
	name=ID code=ID;

Command:
	name=ID code=ID;

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
