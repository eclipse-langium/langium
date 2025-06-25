grammar <%= LanguageName %>

// TODO: Declare your grammar
// See doc : https://langium.org/docs/learn/workflow/write_grammar/

entry <%= EntryName %>: (elements += Element)*;

Element:
    'element' name=ID;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
