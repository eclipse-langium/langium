/* eslint-disable */
import { createToken, Lexer, CstParser } from "chevrotain"

const Cardinality = createToken({ name: "Cardinality", pattern: Lexer.NA });
const AssignType = createToken({ name: "AssignType", pattern: Lexer.NA });

const Id = createToken({ name: "Id", pattern: /\^?[a-zA-Z]\w*/ });
const Grammar = createToken({ name: "Grammar", pattern: /grammar/, longer_alt: Id });
const Dot = createToken({ name: "Dot", pattern: /\./ });
const Colon = createToken({ name: "Colon", pattern: /:/ });
const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });
const Equals = createToken({ name: "Equals", pattern: /=/, categories: AssignType });
const OptionEquals = createToken({ name: "OptionEquals", pattern: /\?=/, categories: AssignType });
const ListEquals = createToken({ name: "ListEquals", pattern: /\+=/, categories: AssignType });
const Returns = createToken({ name: "Returns", pattern: /returns/ });
const Alt = createToken({ name: "Alt", pattern: /\|/ });
const Option = createToken({ name: "Option", pattern: /\?/, categories: Cardinality });
const Asterisk = createToken({ name: "Asterisk", pattern: /\*/, categories: Cardinality });
const AtLeastOne = createToken({ name: "AtLeastOne", pattern: /\+/, categories: Cardinality });
const Current = createToken({ name: "Current", pattern: /current/ });

const ParenthesesOpen = createToken({ name: "ParenthesesOpen", pattern: /\(/ });
const ParenthesesClose = createToken({ name: "ParenthesesClose", pattern: /\)/ });
const CurlyOpen = createToken({ name: "CurlyOpen", pattern: /\{/ });
const CurlyClose = createToken({ name: "CurlyClose", pattern: /\}/ });
const BracketOpen = createToken({ name: "BracketOpen", pattern: /\[/ });
const BracketClose = createToken({ name: "BracketClose", pattern: /\]/ });

const StringLiteral = createToken({
    name: "Keyword", pattern: /"[^"]*"|'[^']*'/
});

const WhiteSpace = createToken({
    name: "WhiteSpace",
    pattern: /\s+/,
    group: Lexer.SKIPPED
});

const xtextTokens = [WhiteSpace, StringLiteral, Grammar, Returns, Current, Id, Cardinality, AssignType,
    OptionEquals, ListEquals, Option, Asterisk, AtLeastOne, Colon, Semicolon,
    Equals, Alt, ParenthesesOpen, ParenthesesClose, CurlyOpen, CurlyClose,
    BracketOpen, BracketClose, Dot];

const XtextLexer = new Lexer(xtextTokens);

// Labels only affect error messages and Diagrams.
Semicolon.LABEL = "';'";
Colon.LABEL = "':'";

export class XtextParser extends CstParser {
    constructor() {
        super(xtextTokens, { recoveryEnabled: true, nodeLocationTracking: "onlyOffset" })
        this.performSelfAnalysis();
    }

    public xtext = this.RULE("xtext", () => {
        this.CONSUME(Grammar);
        this.CONSUME(Id, { LABEL: "name" });
        this.MANY(() => {
            this.SUBRULE(this.rule);
        });
    });

    private rule = this.RULE("rule", () => {
        this.CONSUME(Id, { LABEL: "name" });
        this.OPTION(() => {
            this.CONSUME(Returns);
            this.CONSUME2(Id, { LABEL: 'returnType' });
        });
        this.CONSUME(Colon);
        this.SUBRULE(this.alternatives);
        this.CONSUME(Semicolon);
    });

    private alternatives = this.RULE("alternatives", () => {
        this.SUBRULE(this.group);
        this.MANY(() => {
            this.CONSUME(Alt);
            this.SUBRULE2(this.group);
        });
    });

    private group = this.RULE("group", () => {
        this.AT_LEAST_ONE(() => {
            this.OR([
                { ALT: () => this.CONSUME(StringLiteral) },
                { ALT: () => this.SUBRULE(this.assignment) },
                { ALT: () => this.SUBRULE(this.action) },
                { ALT: () => this.SUBRULE(this.parenthesizedGroup) },
                { ALT: () => this.CONSUME(Id) }
            ]);
        });
    });

    private action = this.RULE("action", () => {
        this.CONSUME(CurlyOpen);
        this.CONSUME(Id, { LABEL: "name" });
        this.OPTION(() => {
            this.CONSUME(Dot);
            this.CONSUME2(Id, { LABEL: "variable" });
            this.CONSUME(AssignType, { LABEL: "assign" });
            this.CONSUME(Current);
        });
        this.CONSUME(CurlyClose);
    });

    private parenthesizedGroup = this.RULE("parenthesizedGroup", () => {
        this.CONSUME(ParenthesesOpen);
        this.SUBRULE(this.alternatives);
        this.CONSUME(ParenthesesClose);
        this.OPTION(() => this.CONSUME(Cardinality, { LABEL: "card" }));
    });

    private assignment = this.RULE("assignment", () => {
        this.CONSUME1(Id, { LABEL: 'name' });
        this.CONSUME(AssignType, { LABEL: "assign" });
        this.OR([
            { ALT: () => this.CONSUME2(Id, { LABEL: 'value' }) },
            { ALT: () => this.SUBRULE(this.crossReference) },
            { ALT: () => this.CONSUME(StringLiteral, { LABEL: 'keyword' }) },
            { ALT: () => {
                this.CONSUME(ParenthesesOpen);
                this.MANY_SEP({
                    SEP: Alt,
                    DEF: () => {
                        this.CONSUME2(StringLiteral, { LABEL: 'keyword' });
                    }
                });
                this.CONSUME(ParenthesesClose);
            }}
        ]);
        this.OPTION(() => this.CONSUME(Cardinality, { LABEL: "card" }));
    });

    private crossReference = this.RULE("crossReference", () => {
        this.CONSUME(BracketOpen);
        this.CONSUME(Id, { LABEL: "target" });
        this.OPTION(() => {
            this.CONSUME(Alt);
            this.CONSUME2(Id, { LABEL: "type" });
        });
        this.CONSUME(BracketClose);
    });
}

const parser = new XtextParser();

export function parseXtext(text: string) {
    const lexResult = XtextLexer.tokenize(text)
    // setting a new input will RESET the parser instance's state.
    parser.input = lexResult.tokens
    // any top level rule may be used as an entry point
    const cst = parser.xtext()

    return {
        cst: cst,
        lexErrors: lexResult.errors,
        parseErrors: parser.errors
    }
}