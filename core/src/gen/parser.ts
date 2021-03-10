import { createToken, Lexer, EmbeddedActionsParser } from "chevrotain";
import { PartialDeep } from "type-fest";
import { RuleResult } from "../generator/ast-node";
import { Grammar, GrammarID, AbstractRule, AbstractMetamodelDeclaration, GeneratedMetamodel, ReferencedMetamodel, Annotation, ParserRule, RuleNameAndParams, Parameter, Alternatives, UnorderedGroup, Group, AbstractToken, AbstractTokenWithCardinality, Action, AbstractTerminal, Keyword, RuleCall, NamedArgument, LiteralCondition, Disjunction, Conjunction, Negation, Atom, ParenthesizedCondition, ParameterReference, TerminalRuleCall, RuleID, PredicatedKeyword, PredicatedRuleCall, Assignment, AssignableTerminal, ParenthesizedAssignableElement, AssignableAlternatives, CrossReference, CrossReferenceableTerminal, ParenthesizedElement, PredicatedGroup, TerminalRule, TerminalAlternatives, TerminalGroup, TerminalToken, TerminalTokenElement, ParenthesizedTerminalElement, AbstractNegatedToken, NegatedToken, UntilToken, Wildcard, CharacterRange, EnumRule, EnumLiterals, EnumLiteralDeclaration, } from "./ast";

const GenerateKeyword = createToken({ name: 'GenerateKeyword', pattern: /generate/ });
const FragmentKeyword = createToken({ name: 'FragmentKeyword', pattern: /fragment/ });
const TerminalKeyword = createToken({ name: 'TerminalKeyword', pattern: /terminal/ });
const GrammarKeyword = createToken({ name: 'GrammarKeyword', pattern: /grammar/ });
const ReturnsKeyword = createToken({ name: 'ReturnsKeyword', pattern: /returns/ });
const CurrentKeyword = createToken({ name: 'CurrentKeyword', pattern: /current/ });
const HiddenKeyword = createToken({ name: 'HiddenKeyword', pattern: /hidden/ });
const ImportKeyword = createToken({ name: 'ImportKeyword', pattern: /import/ });
const FalseKeyword = createToken({ name: 'FalseKeyword', pattern: /false/ });
const WithKeyword = createToken({ name: 'WithKeyword', pattern: /with/ });
const TrueKeyword = createToken({ name: 'TrueKeyword', pattern: /true/ });
const EnumKeyword = createToken({ name: 'EnumKeyword', pattern: /enum/ });
const AsKeyword = createToken({ name: 'AsKeyword', pattern: /as/ });
const PlusEqualsKeyword = createToken({ name: 'PlusEqualsKeyword', pattern: /\+=/ });
const ColonColonKeyword = createToken({ name: 'ColonColonKeyword', pattern: /::/ });
const EqualsMoreThanKeyword = createToken({ name: 'EqualsMoreThanKeyword', pattern: /=>/ });
const DashMoreThanKeyword = createToken({ name: 'DashMoreThanKeyword', pattern: /->/ });
const QuestionMarkEqualsKeyword = createToken({ name: 'QuestionMarkEqualsKeyword', pattern: /\?=/ });
const DotDotKeyword = createToken({ name: 'DotDotKeyword', pattern: /\.\./ });
const CommaKeyword = createToken({ name: 'CommaKeyword', pattern: /,/ });
const ParenthesisOpenKeyword = createToken({ name: 'ParenthesisOpenKeyword', pattern: /\(/ });
const ParenthesisCloseKeyword = createToken({ name: 'ParenthesisCloseKeyword', pattern: /\)/ });
const DotKeyword = createToken({ name: 'DotKeyword', pattern: /\./ });
const AtKeyword = createToken({ name: 'AtKeyword', pattern: /@/ });
const LessThanKeyword = createToken({ name: 'LessThanKeyword', pattern: /</ });
const MoreThanKeyword = createToken({ name: 'MoreThanKeyword', pattern: />/ });
const AsteriskKeyword = createToken({ name: 'AsteriskKeyword', pattern: /\*/ });
const ColonKeyword = createToken({ name: 'ColonKeyword', pattern: /:/ });
const SemicolonKeyword = createToken({ name: 'SemicolonKeyword', pattern: /;/ });
const PipeKeyword = createToken({ name: 'PipeKeyword', pattern: /\|/ });
const AmpersandKeyword = createToken({ name: 'AmpersandKeyword', pattern: /&/ });
const QuestionMarkKeyword = createToken({ name: 'QuestionMarkKeyword', pattern: /\?/ });
const PlusKeyword = createToken({ name: 'PlusKeyword', pattern: /\+/ });
const CurlyOpenKeyword = createToken({ name: 'CurlyOpenKeyword', pattern: /\{/ });
const EqualsKeyword = createToken({ name: 'EqualsKeyword', pattern: /=/ });
const CurlyCloseKeyword = createToken({ name: 'CurlyCloseKeyword', pattern: /\}/ });
const ExclamationMarkKeyword = createToken({ name: 'ExclamationMarkKeyword', pattern: /!/ });
const BracketOpenKeyword = createToken({ name: 'BracketOpenKeyword', pattern: /\[/ });
const BracketCloseKeyword = createToken({ name: 'BracketCloseKeyword', pattern: /\]/ });
const WS = createToken({ name : 'WS', pattern: /\s+/, group: Lexer.SKIPPED });
const ID = createToken({ name : 'ID', pattern: /\^?[_a-zA-Z][\w_]*/ });
const INT = createToken({ name : 'INT', pattern: /[0-9]+/ });
const string = createToken({ name : 'string', pattern: /"[^"]*"|'[^']*'/ });
const RegexLiteral = createToken({ name : 'RegexLiteral', pattern: /\/(?![*+?])(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\// });

GrammarKeyword.LABEL = "'grammar'";
WithKeyword.LABEL = "'with'";
CommaKeyword.LABEL = "','";
HiddenKeyword.LABEL = "'hidden'";
ParenthesisOpenKeyword.LABEL = "'('";
ParenthesisCloseKeyword.LABEL = "')'";
DotKeyword.LABEL = "'.'";
GenerateKeyword.LABEL = "'generate'";
AsKeyword.LABEL = "'as'";
ImportKeyword.LABEL = "'import'";
AtKeyword.LABEL = "'@'";
FragmentKeyword.LABEL = "'fragment'";
LessThanKeyword.LABEL = "'<'";
MoreThanKeyword.LABEL = "'>'";
AsteriskKeyword.LABEL = "'*'";
ReturnsKeyword.LABEL = "'returns'";
ColonKeyword.LABEL = "':'";
SemicolonKeyword.LABEL = "';'";
PipeKeyword.LABEL = "'|'";
AmpersandKeyword.LABEL = "'&'";
QuestionMarkKeyword.LABEL = "'?'";
PlusKeyword.LABEL = "'+'";
CurlyOpenKeyword.LABEL = "'{'";
EqualsKeyword.LABEL = "'='";
PlusEqualsKeyword.LABEL = "'+='";
CurrentKeyword.LABEL = "'current'";
CurlyCloseKeyword.LABEL = "'}'";
TrueKeyword.LABEL = "'true'";
FalseKeyword.LABEL = "'false'";
ExclamationMarkKeyword.LABEL = "'!'";
ColonColonKeyword.LABEL = "'::'";
EqualsMoreThanKeyword.LABEL = "'=>'";
DashMoreThanKeyword.LABEL = "'->'";
QuestionMarkEqualsKeyword.LABEL = "'?='";
BracketOpenKeyword.LABEL = "'['";
BracketCloseKeyword.LABEL = "']'";
TerminalKeyword.LABEL = "'terminal'";
DotDotKeyword.LABEL = "'..'";
EnumKeyword.LABEL = "'enum'";
const tokens = [GenerateKeyword, FragmentKeyword, TerminalKeyword, GrammarKeyword, ReturnsKeyword, CurrentKeyword, HiddenKeyword, ImportKeyword, FalseKeyword, WithKeyword, TrueKeyword, EnumKeyword, AsKeyword, PlusEqualsKeyword, ColonColonKeyword, EqualsMoreThanKeyword, DashMoreThanKeyword, QuestionMarkEqualsKeyword, DotDotKeyword, CommaKeyword, ParenthesisOpenKeyword, ParenthesisCloseKeyword, DotKeyword, AtKeyword, LessThanKeyword, MoreThanKeyword, AsteriskKeyword, ColonKeyword, SemicolonKeyword, PipeKeyword, AmpersandKeyword, QuestionMarkKeyword, PlusKeyword, CurlyOpenKeyword, EqualsKeyword, CurlyCloseKeyword, ExclamationMarkKeyword, BracketOpenKeyword, BracketCloseKeyword, WS, ID, INT, string, RegexLiteral];

const lexer = new Lexer(tokens);
export class Parser extends EmbeddedActionsParser {
    constructor() {
        super(tokens, { recoveryEnabled: true });
        this.performSelfAnalysis();
    }

    public Grammar: RuleResult<Grammar> = this.RULE("Grammar", () => {
        let Name: string | undefined
        let MetamodelDeclarations: (PartialDeep<AbstractMetamodelDeclaration>)[] = []
        let UsedGrammars: (PartialDeep<Grammar>)[] = []
        let definesHiddenTokens: boolean | undefined
        let HiddenTokens: (PartialDeep<AbstractRule>)[] = []
        let rules: (PartialDeep<AbstractRule>)[] = []
        let refs = new Map<string, string>()
        this.consume(1, GrammarKeyword).image
        Name = this.consume(2, ID).image
        this.option(1, () => {
                this.consume(3, WithKeyword).image
                this.consume(4, ID).image
                this.many(1, () => {
                        this.consume(5, CommaKeyword).image
                        this.consume(6, ID).image
                })
        })
        this.option(3, () => {
                definesHiddenTokens = true;this.consume(7, HiddenKeyword).image
                this.consume(8, ParenthesisOpenKeyword).image
                this.option(2, () => {
                        this.consume(9, ID).image
                        this.many(2, () => {
                                this.consume(10, CommaKeyword).image
                                this.consume(11, ID).image
                        })
                })
                this.consume(12, ParenthesisCloseKeyword).image
        })
        this.many(3, () => {
            MetamodelDeclarations.push(this.subrule(1, this.AbstractMetamodelDeclaration))})
        this.many(4, () => {
                rules.push(this.subrule(2, this.AbstractRule))
        })
        return <PartialDeep<Grammar>> {
            kind: "Grammar",
            '.references': refs,
            Name,
            MetamodelDeclarations,
            UsedGrammars,
            definesHiddenTokens,
            HiddenTokens,
            rules,
        }
    })

    private GrammarID = this.RULE("GrammarID", () => {
        let refs = new Map<string, string>()
        this.consume(1, ID).image
        this.many(1, () => {
                this.consume(2, DotKeyword).image
                this.consume(3, ID).image
        })
    })

    private AbstractRule = this.RULE("AbstractRule", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.ParserRule)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.TerminalRule)
                }
            },
            {
                ALT: () => {
                    return this.subrule(3, this.EnumRule)
                }
            },
        ])
    })

    private AbstractMetamodelDeclaration = this.RULE("AbstractMetamodelDeclaration", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.GeneratedMetamodel)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.ReferencedMetamodel)
                }
            },
        ])
    })

    private GeneratedMetamodel: RuleResult<GeneratedMetamodel> = this.RULE("GeneratedMetamodel", () => {
        let Name: string | undefined
        let EPackage: string | undefined
        let Alias: string | undefined
        let refs = new Map<string, string>()
        this.consume(1, GenerateKeyword).image
        Name = this.consume(2, ID).image
        refs.set("EPackage", this.consume(3, ID).image)
        this.option(1, () => {
                this.consume(4, AsKeyword).image
                Alias = this.consume(5, ID).image
        })
        return <PartialDeep<GeneratedMetamodel>> {
            kind: "GeneratedMetamodel",
            '.references': refs,
            Name,
            EPackage,
            Alias,
        }
    })

    private ReferencedMetamodel: RuleResult<ReferencedMetamodel> = this.RULE("ReferencedMetamodel", () => {
        let EPackage: string | undefined
        let Alias: string | undefined
        let refs = new Map<string, string>()
        this.consume(1, ImportKeyword).image
        refs.set("EPackage", this.consume(2, ID).image)
        this.option(1, () => {
                this.consume(3, AsKeyword).image
                Alias = this.consume(4, ID).image
        })
        return <PartialDeep<ReferencedMetamodel>> {
            kind: "ReferencedMetamodel",
            '.references': refs,
            EPackage,
            Alias,
        }
    })

    private Annotation: RuleResult<Annotation> = this.RULE("Annotation", () => {
        let Name: string | undefined
        let refs = new Map<string, string>()
        this.consume(1, AtKeyword).image
        Name = this.consume(2, ID).image
        return <PartialDeep<Annotation>> {
            kind: "Annotation",
            '.references': refs,
            Name,
        }
    })

    private ParserRule: RuleResult<ParserRule> = this.RULE("ParserRule", () => {
        let Alternatives: PartialDeep<Alternatives> | undefined
        let fragment: boolean | undefined
        let Name: string | undefined
        let Parameters: (PartialDeep<Parameter>)[] = []
        let wildcard: boolean | undefined
        let Type: string | undefined
        let DefinesHiddenTokens: boolean | undefined
        let HiddenTokens: (PartialDeep<AbstractRule>)[] = []
        let refs = new Map<string, string>()
            this.or(1, [
                {
                    ALT: () => {
                        fragment = true;this.consume(1, FragmentKeyword).image
                        Name = this.consume(2, ID).image
                        this.option(2, () => {
                                this.consume(3, LessThanKeyword).image
                                this.option(1, () => {
                                        Parameters.push(this.subrule(1, this.Parameter))
                                        this.many(1, () => {
                                                this.consume(4, CommaKeyword).image
                                                Parameters.push(this.subrule(2, this.Parameter))
                                        })
                                })
                                this.consume(5, MoreThanKeyword).image
                        })
                            this.or(2, [
                                {
                                    ALT: () => {
                                        wildcard = true;this.consume(6, AsteriskKeyword).image
                                    }
                                },
                                {
                                    ALT: () => {
                                        this.option(3, () => {
                                                this.consume(7, ReturnsKeyword).image
                                                Type = this.consume(8, ID).image
                                        })
                                    }
                                },
                            ])

                    }
                },
                {
                    ALT: () => {
                        Name = this.consume(9, ID).image
                        this.option(5, () => {
                                this.consume(10, LessThanKeyword).image
                                this.option(4, () => {
                                        Parameters.push(this.subrule(3, this.Parameter))
                                        this.many(2, () => {
                                                this.consume(11, CommaKeyword).image
                                                Parameters.push(this.subrule(4, this.Parameter))
                                        })
                                })
                                this.consume(12, MoreThanKeyword).image
                        })
                        this.option(6, () => {
                                this.consume(13, ReturnsKeyword).image
                                Type = this.consume(14, ID).image
                        })
                    }
                },
            ])

        this.option(8, () => {
                DefinesHiddenTokens = true;this.consume(15, HiddenKeyword).image
                this.consume(16, ParenthesisOpenKeyword).image
                this.option(7, () => {
                        this.consume(17, ID).image
                        this.many(3, () => {
                                this.consume(18, CommaKeyword).image
                                this.consume(19, ID).image
                        })
                })
                this.consume(20, ParenthesisCloseKeyword).image
        })
        this.consume(21, ColonKeyword).image
        Alternatives = this.subrule(5, this.Alternatives)
        this.consume(22, SemicolonKeyword).image
        return <PartialDeep<ParserRule>> {
            kind: "ParserRule",
            '.references': refs,
            Alternatives,
            fragment,
            Name,
            Parameters,
            wildcard,
            Type,
            DefinesHiddenTokens,
            HiddenTokens,
        }
    })

    private RuleNameAndParams: RuleResult<RuleNameAndParams> = this.RULE("RuleNameAndParams", () => {
        let Name: string | undefined
        let Parameters: (PartialDeep<Parameter>)[] = []
        let refs = new Map<string, string>()
        Name = this.consume(1, ID).image
        this.option(2, () => {
                this.consume(2, LessThanKeyword).image
                this.option(1, () => {
                        Parameters.push(this.subrule(1, this.Parameter))
                        this.many(1, () => {
                                this.consume(3, CommaKeyword).image
                                Parameters.push(this.subrule(2, this.Parameter))
                        })
                })
                this.consume(4, MoreThanKeyword).image
        })
        return <PartialDeep<RuleNameAndParams>> {
            kind: "RuleNameAndParams",
            '.references': refs,
            Name,
            Parameters,
        }
    })

    private Parameter: RuleResult<Parameter> = this.RULE("Parameter", () => {
        let Name: string | undefined
        let refs = new Map<string, string>()
        Name = this.consume(1, ID).image
        return <PartialDeep<Parameter>> {
            kind: "Parameter",
            '.references': refs,
            Name,
        }
    })

    private Alternatives: RuleResult<Alternatives> = this.RULE("Alternatives", () => {
        let Elements: (PartialDeep<UnorderedGroup>)[] = []
        let refs = new Map<string, string>()
        Elements.push(this.subrule(1, this.UnorderedGroup))
        this.many(1, () => {
                this.consume(1, PipeKeyword).image
                Elements.push(this.subrule(2, this.UnorderedGroup))
        })
        return <PartialDeep<Alternatives>> {
            kind: "Alternatives",
            '.references': refs,
            Elements,
        }
    })

    private UnorderedGroup: RuleResult<UnorderedGroup> = this.RULE("UnorderedGroup", () => {
        let Elements: (PartialDeep<Group>)[] = []
        let refs = new Map<string, string>()
        Elements.push(this.subrule(1, this.Group))
        this.many(1, () => {
                this.consume(1, AmpersandKeyword).image
                Elements.push(this.subrule(2, this.Group))
        })
        return <PartialDeep<UnorderedGroup>> {
            kind: "UnorderedGroup",
            '.references': refs,
            Elements,
        }
    })

    private Group: RuleResult<Group> = this.RULE("Group", () => {
        let Elements: (PartialDeep<AbstractToken>)[] = []
        let refs = new Map<string, string>()
        this.many(1, () => {
            Elements.push(this.subrule(1, this.AbstractToken))})
        return <PartialDeep<Group>> {
            kind: "Group",
            '.references': refs,
            Elements,
        }
    })

    private AbstractToken = this.RULE("AbstractToken", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.AbstractTokenWithCardinality)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.Action)
                }
            },
        ])
    })

    private AbstractTokenWithCardinality: RuleResult<AbstractTokenWithCardinality> = this.RULE("AbstractTokenWithCardinality", () => {
        let Cardinality: string | undefined
        let Assignment: PartialDeep<Assignment> | undefined
        let Terminal: PartialDeep<AbstractTerminal> | undefined
        let refs = new Map<string, string>()
            this.or(1, [
                {
                    ALT: () => {
                        Assignment = this.subrule(1, this.Assignment)
                    }
                },
                {
                    ALT: () => {
                        Terminal = this.subrule(2, this.AbstractTerminal)
                    }
                },
            ])

        this.option(1, () => {
            Cardinality = this.or(2, [
            { ALT: () => {
            return this.consume(1, QuestionMarkKeyword).image
            }},
            { ALT: () => {
            return this.consume(2, AsteriskKeyword).image
            }},
            { ALT: () => {
            return this.consume(3, PlusKeyword).image
            }},
            ])})
        return <PartialDeep<AbstractTokenWithCardinality>> {
            kind: "AbstractTokenWithCardinality",
            '.references': refs,
            Cardinality,
            Assignment,
            Terminal,
        }
    })

    private Action: RuleResult<Action> = this.RULE("Action", () => {
        let Type: PartialDeep<ParserRule> | undefined
        let Feature: string | undefined
        let Operator: string | undefined
        let refs = new Map<string, string>()
        this.consume(1, CurlyOpenKeyword).image
        refs.set("Type", this.consume(2, ID).image)
        this.option(1, () => {
                this.consume(3, DotKeyword).image
                Feature = this.consume(4, ID).image
                Operator = this.or(1, [
                { ALT: () => {
                return this.consume(5, EqualsKeyword).image
                }},
                { ALT: () => {
                return this.consume(6, PlusEqualsKeyword).image
                }},
                ])
                this.consume(7, CurrentKeyword).image
        })
        this.consume(8, CurlyCloseKeyword).image
        return <PartialDeep<Action>> {
            kind: "Action",
            '.references': refs,
            Type,
            Feature,
            Operator,
        }
    })

    private AbstractTerminal = this.RULE("AbstractTerminal", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.Keyword)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.RuleCall)
                }
            },
            {
                ALT: () => {
                    return this.subrule(3, this.ParenthesizedElement)
                }
            },
            {
                ALT: () => {
                    return this.subrule(4, this.PredicatedKeyword)
                }
            },
            {
                ALT: () => {
                    return this.subrule(5, this.PredicatedRuleCall)
                }
            },
            {
                ALT: () => {
                    return this.subrule(6, this.PredicatedGroup)
                }
            },
        ])
    })

    private Keyword: RuleResult<Keyword> = this.RULE("Keyword", () => {
        let Value: string | undefined
        let refs = new Map<string, string>()
        Value = this.consume(1, string).image
        return <PartialDeep<Keyword>> {
            kind: "Keyword",
            '.references': refs,
            Value,
        }
    })

    private RuleCall: RuleResult<RuleCall> = this.RULE("RuleCall", () => {
        let Rule: PartialDeep<AbstractRule> | undefined
        let Arguments: (PartialDeep<NamedArgument>)[] = []
        let refs = new Map<string, string>()
        refs.set("Rule", this.consume(1, ID).image)
        this.option(1, () => {
                this.consume(2, LessThanKeyword).image
                Arguments.push(this.subrule(1, this.NamedArgument))
                this.many(1, () => {
                        this.consume(3, CommaKeyword).image
                        Arguments.push(this.subrule(2, this.NamedArgument))
                })
                this.consume(4, MoreThanKeyword).image
        })
        return <PartialDeep<RuleCall>> {
            kind: "RuleCall",
            '.references': refs,
            Rule,
            Arguments,
        }
    })

    private NamedArgument: RuleResult<NamedArgument> = this.RULE("NamedArgument", () => {
        let Parameter: PartialDeep<Parameter> | undefined
        let CalledByName: boolean | undefined
        let Value: PartialDeep<Disjunction> | undefined
        let refs = new Map<string, string>()
        this.option(1, () => {
                refs.set("Parameter", this.consume(1, ID).image)
                CalledByName = true;this.consume(2, EqualsKeyword).image
        })
            Value = this.subrule(1, this.Disjunction)

        return <PartialDeep<NamedArgument>> {
            kind: "NamedArgument",
            '.references': refs,
            Parameter,
            CalledByName,
            Value,
        }
    })

    private LiteralCondition: RuleResult<LiteralCondition> = this.RULE("LiteralCondition", () => {
        let True: boolean | undefined
        let refs = new Map<string, string>()
            this.or(1, [
                {
                    ALT: () => {
                        True = true;this.consume(1, TrueKeyword).image
                    }
                },
                {
                    ALT: () => {
                        this.consume(2, FalseKeyword).image
                    }
                },
            ])

        return <PartialDeep<LiteralCondition>> {
            kind: "LiteralCondition",
            '.references': refs,
            True,
        }
    })

    private Disjunction: RuleResult<Disjunction> = this.RULE("Disjunction", () => {
        let Left: PartialDeep<Conjunction> | undefined
        let Right: PartialDeep<Conjunction> | undefined
        let refs = new Map<string, string>()
        Left = this.subrule(1, this.Conjunction)
        this.option(1, () => {
                this.consume(1, PipeKeyword).image
                Right = this.subrule(2, this.Conjunction)
        })
        return <PartialDeep<Disjunction>> {
            kind: "Disjunction",
            '.references': refs,
            Left,
            Right,
        }
    })

    private Conjunction: RuleResult<Conjunction> = this.RULE("Conjunction", () => {
        let Left: PartialDeep<Negation> | undefined
        let Right: PartialDeep<Negation> | undefined
        let refs = new Map<string, string>()
        Left = this.subrule(1, this.Negation)
        this.option(1, () => {
                this.consume(1, AmpersandKeyword).image
                Right = this.subrule(2, this.Negation)
        })
        return <PartialDeep<Conjunction>> {
            kind: "Conjunction",
            '.references': refs,
            Left,
            Right,
        }
    })

    private Negation: RuleResult<Negation> = this.RULE("Negation", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.Atom)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.Negation_1)}
            },
        ])
    })

    private Negation_1: RuleResult<Negation> = this.RULE("Negation_1", () => {
        let Value: PartialDeep<Negation> | undefined
        let refs = new Map<string, string>()
    this.consume(1, ExclamationMarkKeyword).image
    Value = this.subrule(3, this.Negation)
        return <PartialDeep<Negation>> {
            kind: "Negation",
            '.references': refs,
            Value,
        }
    })

    private Atom = this.RULE("Atom", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.ParameterReference)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.ParenthesizedCondition)
                }
            },
            {
                ALT: () => {
                    return this.subrule(3, this.LiteralCondition)
                }
            },
        ])
    })

    private ParenthesizedCondition = this.RULE("ParenthesizedCondition", () => {
        let refs = new Map<string, string>()
        this.consume(1, ParenthesisOpenKeyword).image
        this.subrule(1, this.Disjunction)
        this.consume(2, ParenthesisCloseKeyword).image
    })

    private ParameterReference: RuleResult<ParameterReference> = this.RULE("ParameterReference", () => {
        let Parameter: PartialDeep<Parameter> | undefined
        let refs = new Map<string, string>()
        refs.set("Parameter", this.consume(1, ID).image)
        return <PartialDeep<ParameterReference>> {
            kind: "ParameterReference",
            '.references': refs,
            Parameter,
        }
    })

    private TerminalRuleCall: RuleResult<TerminalRuleCall> = this.RULE("TerminalRuleCall", () => {
        let Rule: PartialDeep<AbstractRule> | undefined
        let refs = new Map<string, string>()
        refs.set("Rule", this.consume(1, ID).image)
        return <PartialDeep<TerminalRuleCall>> {
            kind: "TerminalRuleCall",
            '.references': refs,
            Rule,
        }
    })

    private RuleID = this.RULE("RuleID", () => {
        let refs = new Map<string, string>()
        this.consume(1, ID).image
        this.many(1, () => {
                this.consume(2, ColonColonKeyword).image
                this.consume(3, ID).image
        })
    })

    private PredicatedKeyword: RuleResult<PredicatedKeyword> = this.RULE("PredicatedKeyword", () => {
        let Value: string | undefined
        let Predicated: boolean | undefined
        let FirstSetPredicated: boolean | undefined
        let refs = new Map<string, string>()
            this.or(1, [
                {
                    ALT: () => {
                        Predicated = true;this.consume(1, EqualsMoreThanKeyword).image
                    }
                },
                {
                    ALT: () => {
                        FirstSetPredicated = true;this.consume(2, DashMoreThanKeyword).image
                    }
                },
            ])

        Value = this.consume(3, string).image
        return <PartialDeep<PredicatedKeyword>> {
            kind: "PredicatedKeyword",
            '.references': refs,
            Value,
            Predicated,
            FirstSetPredicated,
        }
    })

    private PredicatedRuleCall: RuleResult<PredicatedRuleCall> = this.RULE("PredicatedRuleCall", () => {
        let Rule: PartialDeep<AbstractRule> | undefined
        let Predicated: boolean | undefined
        let FirstSetPredicated: boolean | undefined
        let Arguments: (PartialDeep<NamedArgument>)[] = []
        let refs = new Map<string, string>()
            this.or(1, [
                {
                    ALT: () => {
                        Predicated = true;this.consume(1, EqualsMoreThanKeyword).image
                    }
                },
                {
                    ALT: () => {
                        FirstSetPredicated = true;this.consume(2, DashMoreThanKeyword).image
                    }
                },
            ])

        refs.set("Rule", this.consume(3, ID).image)
        this.option(1, () => {
                this.consume(4, LessThanKeyword).image
                Arguments.push(this.subrule(1, this.NamedArgument))
                this.many(1, () => {
                        this.consume(5, CommaKeyword).image
                        Arguments.push(this.subrule(2, this.NamedArgument))
                })
                this.consume(6, MoreThanKeyword).image
        })
        return <PartialDeep<PredicatedRuleCall>> {
            kind: "PredicatedRuleCall",
            '.references': refs,
            Rule,
            Predicated,
            FirstSetPredicated,
            Arguments,
        }
    })

    private Assignment: RuleResult<Assignment> = this.RULE("Assignment", () => {
        let Feature: string | undefined
        let Operator: string | undefined
        let Terminal: PartialDeep<AssignableTerminal> | undefined
        let Predicated: boolean | undefined
        let FirstSetPredicated: boolean | undefined
        let refs = new Map<string, string>()
        this.option(1, () => {
                this.or(1, [
                    {
                        ALT: () => {
                            Predicated = true;this.consume(1, EqualsMoreThanKeyword).image
                        }
                    },
                    {
                        ALT: () => {
                            FirstSetPredicated = true;this.consume(2, DashMoreThanKeyword).image
                        }
                    },
                ])
        })
        Feature = this.consume(3, ID).image
        Operator = this.or(2, [
        { ALT: () => {
        return this.consume(4, PlusEqualsKeyword).image
        }},
        { ALT: () => {
        return this.consume(5, EqualsKeyword).image
        }},
        { ALT: () => {
        return this.consume(6, QuestionMarkEqualsKeyword).image
        }},
        ])
        Terminal = this.subrule(1, this.AssignableTerminal)
        return <PartialDeep<Assignment>> {
            kind: "Assignment",
            '.references': refs,
            Feature,
            Operator,
            Terminal,
            Predicated,
            FirstSetPredicated,
        }
    })

    private AssignableTerminal = this.RULE("AssignableTerminal", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.Keyword)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.RuleCall)
                }
            },
            {
                ALT: () => {
                    return this.subrule(3, this.ParenthesizedAssignableElement)
                }
            },
            {
                ALT: () => {
                    return this.subrule(4, this.CrossReference)
                }
            },
        ])
    })

    private ParenthesizedAssignableElement: RuleResult<ParenthesizedAssignableElement> = this.RULE("ParenthesizedAssignableElement", () => {
        let Alternatives: PartialDeep<AssignableAlternatives> | undefined
        let refs = new Map<string, string>()
        this.consume(1, ParenthesisOpenKeyword).image
        Alternatives = this.subrule(1, this.AssignableAlternatives)
        this.consume(2, ParenthesisCloseKeyword).image
        return <PartialDeep<ParenthesizedAssignableElement>> {
            kind: "ParenthesizedAssignableElement",
            '.references': refs,
            Alternatives,
        }
    })

    private AssignableAlternatives: RuleResult<AssignableAlternatives> = this.RULE("AssignableAlternatives", () => {
        let Elements: (PartialDeep<AssignableTerminal>)[] = []
        let refs = new Map<string, string>()
        Elements.push(this.subrule(1, this.AssignableTerminal))
        this.many(1, () => {
                this.consume(1, PipeKeyword).image
                Elements.push(this.subrule(2, this.AssignableTerminal))
        })
        return <PartialDeep<AssignableAlternatives>> {
            kind: "AssignableAlternatives",
            '.references': refs,
            Elements,
        }
    })

    private CrossReference: RuleResult<CrossReference> = this.RULE("CrossReference", () => {
        let Type: PartialDeep<ParserRule> | undefined
        let Terminal: PartialDeep<CrossReferenceableTerminal> | undefined
        let refs = new Map<string, string>()
        this.consume(1, BracketOpenKeyword).image
        refs.set("Type", this.consume(2, ID).image)
        this.option(1, () => {
                this.consume(3, PipeKeyword).image
                Terminal = this.subrule(1, this.CrossReferenceableTerminal)
        })
        this.consume(4, BracketCloseKeyword).image
        return <PartialDeep<CrossReference>> {
            kind: "CrossReference",
            '.references': refs,
            Type,
            Terminal,
        }
    })

    private CrossReferenceableTerminal = this.RULE("CrossReferenceableTerminal", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.Keyword)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.RuleCall)
                }
            },
        ])
    })

    private ParenthesizedElement: RuleResult<ParenthesizedElement> = this.RULE("ParenthesizedElement", () => {
        let Alternatives: PartialDeep<Alternatives> | undefined
        let refs = new Map<string, string>()
        this.consume(1, ParenthesisOpenKeyword).image
        Alternatives = this.subrule(1, this.Alternatives)
        this.consume(2, ParenthesisCloseKeyword).image
        return <PartialDeep<ParenthesizedElement>> {
            kind: "ParenthesizedElement",
            '.references': refs,
            Alternatives,
        }
    })

    private PredicatedGroup: RuleResult<PredicatedGroup> = this.RULE("PredicatedGroup", () => {
        let Elements: (PartialDeep<Alternatives>)[] = []
        let Predicated: boolean | undefined
        let FirstSetPredicated: boolean | undefined
        let refs = new Map<string, string>()
            this.or(1, [
                {
                    ALT: () => {
                        Predicated = true;this.consume(1, EqualsMoreThanKeyword).image
                    }
                },
                {
                    ALT: () => {
                        FirstSetPredicated = true;this.consume(2, DashMoreThanKeyword).image
                    }
                },
            ])

        this.consume(3, ParenthesisOpenKeyword).image
        Elements.push(this.subrule(1, this.Alternatives))
        this.consume(4, ParenthesisCloseKeyword).image
        return <PartialDeep<PredicatedGroup>> {
            kind: "PredicatedGroup",
            '.references': refs,
            Elements,
            Predicated,
            FirstSetPredicated,
        }
    })

    private TerminalRule: RuleResult<TerminalRule> = this.RULE("TerminalRule", () => {
        let Regex: string | undefined
        let Fragment: boolean | undefined
        let Name: string | undefined
        let Type: string | undefined
        let refs = new Map<string, string>()
        this.consume(1, TerminalKeyword).image
            this.or(1, [
                {
                    ALT: () => {
                        Fragment = true;this.consume(2, FragmentKeyword).image
                        Name = this.consume(3, ID).image
                    }
                },
                {
                    ALT: () => {
                        Name = this.consume(4, ID).image
                        this.option(1, () => {
                                this.consume(5, ReturnsKeyword).image
                                Type = this.consume(6, ID).image
                        })
                    }
                },
            ])

        this.consume(7, ColonKeyword).image
        Regex = this.consume(8, RegexLiteral).image
        this.consume(9, SemicolonKeyword).image
        return <PartialDeep<TerminalRule>> {
            kind: "TerminalRule",
            '.references': refs,
            Regex,
            Fragment,
            Name,
            Type,
        }
    })

    private TerminalAlternatives: RuleResult<TerminalAlternatives> = this.RULE("TerminalAlternatives", () => {
        let Elements: (PartialDeep<TerminalGroup>)[] = []
        let refs = new Map<string, string>()
        Elements.push(this.subrule(1, this.TerminalGroup))
        this.many(1, () => {
                this.consume(1, PipeKeyword).image
                Elements.push(this.subrule(2, this.TerminalGroup))
        })
        return <PartialDeep<TerminalAlternatives>> {
            kind: "TerminalAlternatives",
            '.references': refs,
            Elements,
        }
    })

    private TerminalGroup: RuleResult<TerminalGroup> = this.RULE("TerminalGroup", () => {
        let Elements: (PartialDeep<TerminalToken>)[] = []
        let refs = new Map<string, string>()
        this.many(1, () => {
            Elements.push(this.subrule(1, this.TerminalToken))})
        return <PartialDeep<TerminalGroup>> {
            kind: "TerminalGroup",
            '.references': refs,
            Elements,
        }
    })

    private TerminalToken: RuleResult<TerminalToken> = this.RULE("TerminalToken", () => {
        let Cardinality: string | undefined
        let refs = new Map<string, string>()
        this.subrule(1, this.TerminalTokenElement)
        this.option(1, () => {
            Cardinality = this.or(1, [
            { ALT: () => {
            return this.consume(1, QuestionMarkKeyword).image
            }},
            { ALT: () => {
            return this.consume(2, AsteriskKeyword).image
            }},
            { ALT: () => {
            return this.consume(3, PlusKeyword).image
            }},
            ])})
        return <PartialDeep<TerminalToken>> {
            kind: "TerminalToken",
            '.references': refs,
            Cardinality,
        }
    })

    private TerminalTokenElement = this.RULE("TerminalTokenElement", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.CharacterRange)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.TerminalRuleCall)
                }
            },
            {
                ALT: () => {
                    return this.subrule(3, this.ParenthesizedTerminalElement)
                }
            },
            {
                ALT: () => {
                    return this.subrule(4, this.AbstractNegatedToken)
                }
            },
            {
                ALT: () => {
                    return this.subrule(5, this.Wildcard)
                }
            },
        ])
    })

    private ParenthesizedTerminalElement = this.RULE("ParenthesizedTerminalElement", () => {
        let refs = new Map<string, string>()
        this.consume(1, ParenthesisOpenKeyword).image
        this.subrule(1, this.TerminalAlternatives)
        this.consume(2, ParenthesisCloseKeyword).image
    })

    private AbstractNegatedToken = this.RULE("AbstractNegatedToken", () => {
        return this.or(1, [
            {
                ALT: () => {
                    return this.subrule(1, this.NegatedToken)
                }
            },
            {
                ALT: () => {
                    return this.subrule(2, this.UntilToken)
                }
            },
        ])
    })

    private NegatedToken: RuleResult<NegatedToken> = this.RULE("NegatedToken", () => {
        let Terminal: PartialDeep<TerminalTokenElement> | undefined
        let refs = new Map<string, string>()
        this.consume(1, ExclamationMarkKeyword).image
        Terminal = this.subrule(1, this.TerminalTokenElement)
        return <PartialDeep<NegatedToken>> {
            kind: "NegatedToken",
            '.references': refs,
            Terminal,
        }
    })

    private UntilToken: RuleResult<UntilToken> = this.RULE("UntilToken", () => {
        let Terminal: PartialDeep<TerminalTokenElement> | undefined
        let refs = new Map<string, string>()
        this.consume(1, DashMoreThanKeyword).image
        Terminal = this.subrule(1, this.TerminalTokenElement)
        return <PartialDeep<UntilToken>> {
            kind: "UntilToken",
            '.references': refs,
            Terminal,
        }
    })

    private Wildcard = this.RULE("Wildcard", () => {
        let refs = new Map<string, string>()
        this.consume(1, DotKeyword).image
    })

    private CharacterRange: RuleResult<CharacterRange> = this.RULE("CharacterRange", () => {
        let Left: PartialDeep<Keyword> | undefined
        let Right: PartialDeep<Keyword> | undefined
        let refs = new Map<string, string>()
        Left = this.subrule(1, this.Keyword)
        this.option(1, () => {
                this.consume(1, DotDotKeyword).image
                Right = this.subrule(2, this.Keyword)
        })
        return <PartialDeep<CharacterRange>> {
            kind: "CharacterRange",
            '.references': refs,
            Left,
            Right,
        }
    })

    private EnumRule: RuleResult<EnumRule> = this.RULE("EnumRule", () => {
        let Name: string | undefined
        let Alternatives: PartialDeep<EnumLiterals> | undefined
        let Type: string | undefined
        let refs = new Map<string, string>()
        this.consume(1, EnumKeyword).image
        Name = this.consume(2, ID).image
        this.option(1, () => {
                this.consume(3, ReturnsKeyword).image
                Type = this.consume(4, ID).image
        })
        this.consume(5, ColonKeyword).image
        Alternatives = this.subrule(1, this.EnumLiterals)
        this.consume(6, SemicolonKeyword).image
        return <PartialDeep<EnumRule>> {
            kind: "EnumRule",
            '.references': refs,
            Name,
            Alternatives,
            Type,
        }
    })

    private EnumLiterals: RuleResult<EnumLiterals> = this.RULE("EnumLiterals", () => {
        let Elements: (PartialDeep<EnumLiteralDeclaration>)[] = []
        let refs = new Map<string, string>()
        Elements.push(this.subrule(1, this.EnumLiteralDeclaration))
        this.many(1, () => {
                this.consume(1, PipeKeyword).image
                Elements.push(this.subrule(2, this.EnumLiteralDeclaration))
        })
        return <PartialDeep<EnumLiterals>> {
            kind: "EnumLiterals",
            '.references': refs,
            Elements,
        }
    })

    private EnumLiteralDeclaration: RuleResult<EnumLiteralDeclaration> = this.RULE("EnumLiteralDeclaration", () => {
        let EnumLiteral: PartialDeep<EnumLiterals> | undefined
        let Literal: PartialDeep<Keyword> | undefined
        let refs = new Map<string, string>()
        refs.set("EnumLiteral", this.consume(1, ID).image)
        this.option(1, () => {
                this.consume(2, EqualsKeyword).image
                Literal = this.subrule(1, this.Keyword)
        })
        return <PartialDeep<EnumLiteralDeclaration>> {
            kind: "EnumLiteralDeclaration",
            '.references': refs,
            EnumLiteral,
            Literal,
        }
    })


}

const parser = new Parser();

export function parse(text: string) {
    const lexResult = lexer.tokenize(text);
    parser.input = lexResult.tokens;
    const ast = parser.Grammar();
    return {
        ast,
        lexErrors: lexResult.errors,
        parseErrors: parser.errors
    }
}
