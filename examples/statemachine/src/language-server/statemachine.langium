grammar Statemachine

/** A textual represntation of a state machine */
entry Statemachine:
    /** The name of the machine */
    'statemachine' name=ID
    /** The list of recognized event names */
    /* A block comment associated with a group */
    ('events'
    /* A block comment associated with an assignment */
    events+=Event+)?
    ('commands' commands+=Command+)?
    /** The starting state for the machine */
    'initialState' init=[State]
    /** Definitions of available states */
    states+=State*;

/** An event is the trigger for a transition */
Event:
    name=ID; // no comment should be generated for this property

// The preceding comment should not be associated with this rule
Command:
    name=ID;

/** A description of the status of a system */
State:
    'state' name=ID
        ('actions' '{' actions+=[Command]+ '}')?
        /** The transitions to other states that can take place from the current one */
        transitions+=Transition*
    'end';

/** A change from one state to another */
Transition:
    /** The event triggering the transition */
    event=[Event] '=>'
    /** The target state */
    state=[State];

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
