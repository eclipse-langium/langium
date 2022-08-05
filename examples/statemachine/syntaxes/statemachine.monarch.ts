// Monarch syntax highlighting for the statemachine language.
export const languagestatemachine = {

    keywords: [
        'actions','commands','end','events','initialState','state','statemachine'
    ],
    operators: [
        '=>'
    ],
    symbols:  /{|}|=>/,

    folding: {
        markers: {
            start: new RegExp('^\s*//\s*#?region\b'),
            end: new RegExp('^\s*//\s*#?endregion\b')
        }
    },

    tokenizer: {
        initial: [
            { regex: /[_a-zA-Z][\w_]*/, action: { cases: { '@keywords': {"token":"keyword"}, '@default': {"token":"identifier"} }} },
            { regex: /[0-9]+/, action: {"token":"number"} },
            { regex: /"[^"]*"|'[^']*'/, action: {"token":"string"} },
            { include: '@whitespace' },
            { regex: /@symbols/, action: { cases: { '@operators': {"token":"operator"}, '@default': {"token":""} }} },
        ],
        whitespace: [
            { regex: /\s+/, action: {"token":"white"} },
            { regex: /\/\*/, action: {"token":"comment","next":"@comment"} },
            { regex: /\/\/[^\n\r]*/, action: {"token":"comment"} },
        ],
        comment: [
            { regex: /[^\/\*]+/, action: {"token":"comment"} },
            { regex: /\/\*/, action: {"token":"comment","next":"@push"} },
            { regex: /\*\//, action: {"token":"comment","next":"@pop"} },
            { regex: /[\/\*]/, action: {"token":"comment"} },
        ],
    }
};