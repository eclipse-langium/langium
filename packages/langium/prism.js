export default {
    ML_COMMENT: {
        pattern: /\/\*[\s\S]*?\*\//,
        greedy: true
    },
    SL_COMMENT: {
        pattern: /\/\/[^\n\r]*/,
        greedy: true
    },
    STRING: {
        pattern: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/,
        greedy: true
    },
    keyword: {
        pattern: /\b(interface|fragment|terminal|boolean|current|extends|grammar|returns|bigint|hidden|import|infers|number|string|entry|false|infer|Date|true|type|with)\b/
    },
    ID: {
        pattern: /\^?[_a-zA-Z][\w_]*/
    },
    RegexLiteral: {
        pattern: /\/(?![*+?])(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\//
    },
};
