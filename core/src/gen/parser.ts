/* eslint-disable */
// @ts-nocheck
import { createToken, Lexer } from "chevrotain";
import { PartialDeep } from "type-fest";
import { AstNode, RootNode, RuleResult } from "../generator/ast-node";
import { LangiumParser } from "../parser/langium-parser";
import { xtextGrammarAccess } from "./grammar-access";
import { Grammar, AbstractRule, AbstractMetamodelDeclaration, GeneratedMetamodel, ReferencedMetamodel, Annotation, ParserRule, RuleNameAndParams, Parameter, Alternatives, UnorderedGroup, Group, AbstractToken, AbstractTokenWithCardinality, Action, AbstractTerminal, Keyword, RuleCall, NamedArgument, LiteralCondition, Disjunction, Conjunction, Negation, Atom, ParenthesizedCondition, ParameterReference, TerminalRuleCall, PredicatedKeyword, PredicatedRuleCall, Assignment, AssignableTerminal, ParenthesizedAssignableElement, AssignableAlternatives, CrossReference, CrossReferenceableTerminal, ParenthesizedElement, PredicatedGroup, TerminalRule, TerminalAlternatives, TerminalGroup, TerminalToken, TerminalTokenElement, ParenthesizedTerminalElement, AbstractNegatedToken, NegatedToken, UntilToken, Wildcard, CharacterRange, EnumRule, EnumLiterals, EnumLiteralDeclaration, } from "./ast";

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
const EqualsMoreThanKeyword = createToken({ name: 'EqualsMoreThanKeyword', pattern: /=>/ });
const DashMoreThanKeyword = createToken({ name: 'DashMoreThanKeyword', pattern: /->/ });
const QuestionMarkEqualsKeyword = createToken({ name: 'QuestionMarkEqualsKeyword', pattern: /\?=/ });
const DotDotKeyword = createToken({ name: 'DotDotKeyword', pattern: /\.\./ });
const CommaKeyword = createToken({ name: 'CommaKeyword', pattern: /,/ });
const ParenthesisOpenKeyword = createToken({ name: 'ParenthesisOpenKeyword', pattern: /\(/ });
const ParenthesisCloseKeyword = createToken({ name: 'ParenthesisCloseKeyword', pattern: /\)/ });
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
const DotKeyword = createToken({ name: 'DotKeyword', pattern: /\./ });
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
DotKeyword.LABEL = "'.'";
EqualsKeyword.LABEL = "'='";
PlusEqualsKeyword.LABEL = "'+='";
CurrentKeyword.LABEL = "'current'";
CurlyCloseKeyword.LABEL = "'}'";
TrueKeyword.LABEL = "'true'";
FalseKeyword.LABEL = "'false'";
ExclamationMarkKeyword.LABEL = "'!'";
EqualsMoreThanKeyword.LABEL = "'=>'";
DashMoreThanKeyword.LABEL = "'->'";
QuestionMarkEqualsKeyword.LABEL = "'?='";
BracketOpenKeyword.LABEL = "'['";
BracketCloseKeyword.LABEL = "']'";
TerminalKeyword.LABEL = "'terminal'";
DotDotKeyword.LABEL = "'..'";
EnumKeyword.LABEL = "'enum'";
const tokens = [GenerateKeyword, FragmentKeyword, TerminalKeyword, GrammarKeyword, ReturnsKeyword, CurrentKeyword, HiddenKeyword, ImportKeyword, FalseKeyword, WithKeyword, TrueKeyword, EnumKeyword, AsKeyword, PlusEqualsKeyword, EqualsMoreThanKeyword, DashMoreThanKeyword, QuestionMarkEqualsKeyword, DotDotKeyword, CommaKeyword, ParenthesisOpenKeyword, ParenthesisCloseKeyword, AtKeyword, LessThanKeyword, MoreThanKeyword, AsteriskKeyword, ColonKeyword, SemicolonKeyword, PipeKeyword, AmpersandKeyword, QuestionMarkKeyword, PlusKeyword, CurlyOpenKeyword, DotKeyword, EqualsKeyword, CurlyCloseKeyword, ExclamationMarkKeyword, BracketOpenKeyword, BracketCloseKeyword, WS, ID, INT, string, RegexLiteral];

const lexer = new Lexer(tokens);
export class Parser extends LangiumParser {
    grammarAccess: xtextGrammarAccess;
    constructor(grammar: Grammar) {
        super(grammar, tokens);
        this.grammarAccess = new xtextGrammarAccess(grammar);
        this.performSelfAnalysis();
    }

    public Grammar: RuleResult<Grammar> = this.RULE("Grammar", () => {
            this.consumeLeaf(1, GrammarKeyword, this.grammarAccess.Grammar.GrammarKeyword)
            this.consumeLeaf(2, ID, this.grammarAccess.Grammar.Name)
            this.option(1, () => {
                    this.consumeLeaf(3, WithKeyword, this.grammarAccess.Grammar.WithKeyword)
                    this.consumeLeaf(4, ID, this.grammarAccess.Grammar.UsedGrammars)
                    this.many(1, () => {
                            this.consumeLeaf(5, CommaKeyword, this.grammarAccess.Grammar.CommaKeyword)
                            this.consumeLeaf(6, ID, this.grammarAccess.Grammar.UsedGrammars)
                    })
            })
            this.option(3, () => {
                    this.consumeLeaf(7, HiddenKeyword, this.grammarAccess.Grammar.definesHiddenTokens)
                    this.consumeLeaf(8, ParenthesisOpenKeyword, this.grammarAccess.Grammar.ParenthesisOpenKeyword)
                    this.option(2, () => {
                            this.consumeLeaf(9, ID, this.grammarAccess.Grammar.HiddenTokens)
                            this.many(2, () => {
                                    this.consumeLeaf(10, CommaKeyword, this.grammarAccess.Grammar.CommaKeyword)
                                    this.consumeLeaf(11, ID, this.grammarAccess.Grammar.HiddenTokens)
                            })
                    })
                    this.consumeLeaf(12, ParenthesisCloseKeyword, this.grammarAccess.Grammar.ParenthesisCloseKeyword)
            })
            this.many(3, () => {
                this.subruleLeaf(1, this.AbstractMetamodelDeclaration, this.grammarAccess.Grammar.MetamodelDeclarations)})
            this.many(4, () => {
                    this.subruleLeaf(2, this.AbstractRule, this.grammarAccess.Grammar.rules)
            })
        return this.construct<Grammar>('Grammar', true);
    })

    private AbstractRule = this.RULE("AbstractRule", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.ParserRule, this.grammarAccess.AbstractRule.ParserRuleRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.TerminalRule, this.grammarAccess.AbstractRule.TerminalRuleRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(3, this.EnumRule, this.grammarAccess.AbstractRule.EnumRuleRuleCall)
                    }
                },
            ])
        return this.construct<AbstractRule>('AbstractRule');
    })

    private AbstractMetamodelDeclaration = this.RULE("AbstractMetamodelDeclaration", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.GeneratedMetamodel, this.grammarAccess.AbstractMetamodelDeclaration.GeneratedMetamodelRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.ReferencedMetamodel, this.grammarAccess.AbstractMetamodelDeclaration.ReferencedMetamodelRuleCall)
                    }
                },
            ])
        return this.construct<AbstractMetamodelDeclaration>('AbstractMetamodelDeclaration');
    })

    private GeneratedMetamodel: RuleResult<GeneratedMetamodel> = this.RULE("GeneratedMetamodel", () => {
            this.consumeLeaf(1, GenerateKeyword, this.grammarAccess.GeneratedMetamodel.GenerateKeyword)
            this.consumeLeaf(2, ID, this.grammarAccess.GeneratedMetamodel.Name)
            this.consumeLeaf(3, ID, this.grammarAccess.GeneratedMetamodel.EPackage)
            this.option(1, () => {
                    this.consumeLeaf(4, AsKeyword, this.grammarAccess.GeneratedMetamodel.AsKeyword)
                    this.consumeLeaf(5, ID, this.grammarAccess.GeneratedMetamodel.Alias)
            })
        return this.construct<GeneratedMetamodel>('GeneratedMetamodel');
    })

    private ReferencedMetamodel: RuleResult<ReferencedMetamodel> = this.RULE("ReferencedMetamodel", () => {
            this.consumeLeaf(1, ImportKeyword, this.grammarAccess.ReferencedMetamodel.ImportKeyword)
            this.consumeLeaf(2, ID, this.grammarAccess.ReferencedMetamodel.EPackage)
            this.option(1, () => {
                    this.consumeLeaf(3, AsKeyword, this.grammarAccess.ReferencedMetamodel.AsKeyword)
                    this.consumeLeaf(4, ID, this.grammarAccess.ReferencedMetamodel.Alias)
            })
        return this.construct<ReferencedMetamodel>('ReferencedMetamodel');
    })

    private Annotation: RuleResult<Annotation> = this.RULE("Annotation", () => {
            this.consumeLeaf(1, AtKeyword, this.grammarAccess.Annotation.AtKeyword)
            this.consumeLeaf(2, ID, this.grammarAccess.Annotation.Name)
        return this.construct<Annotation>('Annotation');
    })

    private ParserRule: RuleResult<ParserRule> = this.RULE("ParserRule", () => {
                this.or(1, [
                    {
                        ALT: () => {
                            this.consumeLeaf(1, FragmentKeyword, this.grammarAccess.ParserRule.fragment)
                            this.consumeLeaf(2, ID, this.grammarAccess.ParserRule.Name)
                            this.option(2, () => {
                                    this.consumeLeaf(3, LessThanKeyword, this.grammarAccess.ParserRule.LessThanKeyword)
                                    this.option(1, () => {
                                            this.subruleLeaf(1, this.Parameter, this.grammarAccess.ParserRule.Parameters)
                                            this.many(1, () => {
                                                    this.consumeLeaf(4, CommaKeyword, this.grammarAccess.ParserRule.CommaKeyword)
                                                    this.subruleLeaf(2, this.Parameter, this.grammarAccess.ParserRule.Parameters)
                                            })
                                    })
                                    this.consumeLeaf(5, MoreThanKeyword, this.grammarAccess.ParserRule.MoreThanKeyword)
                            })
                                this.or(2, [
                                    {
                                        ALT: () => {
                                            this.consumeLeaf(6, AsteriskKeyword, this.grammarAccess.ParserRule.wildcard)
                                        }
                                    },
                                    {
                                        ALT: () => {
                                            this.option(3, () => {
                                                    this.consumeLeaf(7, ReturnsKeyword, this.grammarAccess.ParserRule.ReturnsKeyword)
                                                    this.consumeLeaf(8, ID, this.grammarAccess.ParserRule.Type)
                                            })
                                        }
                                    },
                                ])

                        }
                    },
                    {
                        ALT: () => {
                            this.consumeLeaf(9, ID, this.grammarAccess.ParserRule.Name)
                            this.option(5, () => {
                                    this.consumeLeaf(10, LessThanKeyword, this.grammarAccess.ParserRule.LessThanKeyword)
                                    this.option(4, () => {
                                            this.subruleLeaf(3, this.Parameter, this.grammarAccess.ParserRule.Parameters)
                                            this.many(2, () => {
                                                    this.consumeLeaf(11, CommaKeyword, this.grammarAccess.ParserRule.CommaKeyword)
                                                    this.subruleLeaf(4, this.Parameter, this.grammarAccess.ParserRule.Parameters)
                                            })
                                    })
                                    this.consumeLeaf(12, MoreThanKeyword, this.grammarAccess.ParserRule.MoreThanKeyword)
                            })
                            this.option(6, () => {
                                    this.consumeLeaf(13, ReturnsKeyword, this.grammarAccess.ParserRule.ReturnsKeyword)
                                    this.consumeLeaf(14, ID, this.grammarAccess.ParserRule.Type)
                            })
                        }
                    },
                ])

            this.option(8, () => {
                    this.consumeLeaf(15, HiddenKeyword, this.grammarAccess.ParserRule.DefinesHiddenTokens)
                    this.consumeLeaf(16, ParenthesisOpenKeyword, this.grammarAccess.ParserRule.ParenthesisOpenKeyword)
                    this.option(7, () => {
                            this.consumeLeaf(17, ID, this.grammarAccess.ParserRule.HiddenTokens)
                            this.many(3, () => {
                                    this.consumeLeaf(18, CommaKeyword, this.grammarAccess.ParserRule.CommaKeyword)
                                    this.consumeLeaf(19, ID, this.grammarAccess.ParserRule.HiddenTokens)
                            })
                    })
                    this.consumeLeaf(20, ParenthesisCloseKeyword, this.grammarAccess.ParserRule.ParenthesisCloseKeyword)
            })
            this.consumeLeaf(21, ColonKeyword, this.grammarAccess.ParserRule.ColonKeyword)
            this.subruleLeaf(5, this.Alternatives, this.grammarAccess.ParserRule.Alternatives)
            this.consumeLeaf(22, SemicolonKeyword, this.grammarAccess.ParserRule.SemicolonKeyword)
        return this.construct<ParserRule>('ParserRule');
    })

    private RuleNameAndParams: RuleResult<RuleNameAndParams> = this.RULE("RuleNameAndParams", () => {
            this.consumeLeaf(1, ID, this.grammarAccess.RuleNameAndParams.Name)
            this.option(2, () => {
                    this.consumeLeaf(2, LessThanKeyword, this.grammarAccess.RuleNameAndParams.LessThanKeyword)
                    this.option(1, () => {
                            this.subruleLeaf(1, this.Parameter, this.grammarAccess.RuleNameAndParams.Parameters)
                            this.many(1, () => {
                                    this.consumeLeaf(3, CommaKeyword, this.grammarAccess.RuleNameAndParams.CommaKeyword)
                                    this.subruleLeaf(2, this.Parameter, this.grammarAccess.RuleNameAndParams.Parameters)
                            })
                    })
                    this.consumeLeaf(4, MoreThanKeyword, this.grammarAccess.RuleNameAndParams.MoreThanKeyword)
            })
        return this.construct<RuleNameAndParams>('RuleNameAndParams');
    })

    private Parameter: RuleResult<Parameter> = this.RULE("Parameter", () => {
            this.consumeLeaf(1, ID, this.grammarAccess.Parameter.Name)
        return this.construct<Parameter>('Parameter');
    })

    private Alternatives: RuleResult<Alternatives> = this.RULE("Alternatives", () => {
            this.subruleLeaf(1, this.UnorderedGroup, this.grammarAccess.Alternatives.Elements)
            this.many(1, () => {
                    this.consumeLeaf(1, PipeKeyword, this.grammarAccess.Alternatives.PipeKeyword)
                    this.subruleLeaf(2, this.UnorderedGroup, this.grammarAccess.Alternatives.Elements)
            })
        return this.construct<Alternatives>('Alternatives');
    })

    private UnorderedGroup: RuleResult<UnorderedGroup> = this.RULE("UnorderedGroup", () => {
            this.subruleLeaf(1, this.Group, this.grammarAccess.UnorderedGroup.Elements)
            this.many(1, () => {
                    this.consumeLeaf(1, AmpersandKeyword, this.grammarAccess.UnorderedGroup.AmpersandKeyword)
                    this.subruleLeaf(2, this.Group, this.grammarAccess.UnorderedGroup.Elements)
            })
        return this.construct<UnorderedGroup>('UnorderedGroup');
    })

    private Group: RuleResult<Group> = this.RULE("Group", () => {
            this.many(1, () => {
                this.subruleLeaf(1, this.AbstractToken, this.grammarAccess.Group.Elements)})
        return this.construct<Group>('Group');
    })

    private AbstractToken = this.RULE("AbstractToken", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.AbstractTokenWithCardinality, this.grammarAccess.AbstractToken.AbstractTokenWithCardinalityRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.Action, this.grammarAccess.AbstractToken.ActionRuleCall)
                    }
                },
            ])
        return this.construct<AbstractToken>('AbstractToken');
    })

    private AbstractTokenWithCardinality: RuleResult<AbstractTokenWithCardinality> = this.RULE("AbstractTokenWithCardinality", () => {
                this.or(1, [
                    {
                        ALT: () => {
                            this.subruleLeaf(1, this.Assignment, this.grammarAccess.AbstractTokenWithCardinality.Assignment)
                        }
                    },
                    {
                        ALT: () => {
                            this.subruleLeaf(2, this.AbstractTerminal, this.grammarAccess.AbstractTokenWithCardinality.Terminal)
                        }
                    },
                ])

            this.option(1, () => {
                this.or(2, [
                { ALT: () => {
                this.consumeLeaf(1, QuestionMarkKeyword, this.grammarAccess.AbstractTokenWithCardinality.Cardinality)
                }},
                { ALT: () => {
                this.consumeLeaf(2, AsteriskKeyword, this.grammarAccess.AbstractTokenWithCardinality.Cardinality)
                }},
                { ALT: () => {
                this.consumeLeaf(3, PlusKeyword, this.grammarAccess.AbstractTokenWithCardinality.Cardinality)
                }},
                ])})
        return this.construct<AbstractTokenWithCardinality>('AbstractTokenWithCardinality');
    })

    private Action: RuleResult<Action> = this.RULE("Action", () => {
            this.consumeLeaf(1, CurlyOpenKeyword, this.grammarAccess.Action.CurlyOpenKeyword)
            this.consumeLeaf(2, ID, this.grammarAccess.Action.Type)
            this.option(1, () => {
                    this.consumeLeaf(3, DotKeyword, this.grammarAccess.Action.DotKeyword)
                    this.consumeLeaf(4, ID, this.grammarAccess.Action.Feature)
                    this.or(1, [
                    { ALT: () => {
                    this.consumeLeaf(5, EqualsKeyword, this.grammarAccess.Action.Operator)
                    }},
                    { ALT: () => {
                    this.consumeLeaf(6, PlusEqualsKeyword, this.grammarAccess.Action.Operator)
                    }},
                    ])
                    this.consumeLeaf(7, CurrentKeyword, this.grammarAccess.Action.CurrentKeyword)
            })
            this.consumeLeaf(8, CurlyCloseKeyword, this.grammarAccess.Action.CurlyCloseKeyword)
        return this.construct<Action>('Action');
    })

    private AbstractTerminal = this.RULE("AbstractTerminal", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.Keyword, this.grammarAccess.AbstractTerminal.KeywordRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.RuleCall, this.grammarAccess.AbstractTerminal.RuleCallRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(3, this.ParenthesizedElement, this.grammarAccess.AbstractTerminal.ParenthesizedElementRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(4, this.PredicatedKeyword, this.grammarAccess.AbstractTerminal.PredicatedKeywordRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(5, this.PredicatedRuleCall, this.grammarAccess.AbstractTerminal.PredicatedRuleCallRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(6, this.PredicatedGroup, this.grammarAccess.AbstractTerminal.PredicatedGroupRuleCall)
                    }
                },
            ])
        return this.construct<AbstractTerminal>('AbstractTerminal');
    })

    private Keyword: RuleResult<Keyword> = this.RULE("Keyword", () => {
            this.consumeLeaf(1, string, this.grammarAccess.Keyword.Value)
        return this.construct<Keyword>('Keyword');
    })

    private RuleCall: RuleResult<RuleCall> = this.RULE("RuleCall", () => {
            this.consumeLeaf(1, ID, this.grammarAccess.RuleCall.Rule)
            this.option(1, () => {
                    this.consumeLeaf(2, LessThanKeyword, this.grammarAccess.RuleCall.LessThanKeyword)
                    this.subruleLeaf(1, this.NamedArgument, this.grammarAccess.RuleCall.Arguments)
                    this.many(1, () => {
                            this.consumeLeaf(3, CommaKeyword, this.grammarAccess.RuleCall.CommaKeyword)
                            this.subruleLeaf(2, this.NamedArgument, this.grammarAccess.RuleCall.Arguments)
                    })
                    this.consumeLeaf(4, MoreThanKeyword, this.grammarAccess.RuleCall.MoreThanKeyword)
            })
        return this.construct<RuleCall>('RuleCall');
    })

    private NamedArgument: RuleResult<NamedArgument> = this.RULE("NamedArgument", () => {
            this.option(1, () => {
                    this.consumeLeaf(1, ID, this.grammarAccess.NamedArgument.Parameter)
                    this.consumeLeaf(2, EqualsKeyword, this.grammarAccess.NamedArgument.CalledByName)
            })
                this.subruleLeaf(1, this.Disjunction, this.grammarAccess.NamedArgument.Value)

        return this.construct<NamedArgument>('NamedArgument');
    })

    private LiteralCondition: RuleResult<LiteralCondition> = this.RULE("LiteralCondition", () => {
                this.or(1, [
                    {
                        ALT: () => {
                            this.consumeLeaf(1, TrueKeyword, this.grammarAccess.LiteralCondition.True)
                        }
                    },
                    {
                        ALT: () => {
                            this.consumeLeaf(2, FalseKeyword, this.grammarAccess.LiteralCondition.FalseKeyword)
                        }
                    },
                ])

        return this.construct<LiteralCondition>('LiteralCondition');
    })

    private Disjunction: RuleResult<Disjunction> = this.RULE("Disjunction", () => {
            this.subruleLeaf(1, this.Conjunction, this.grammarAccess.Disjunction.Left)
            this.option(1, () => {
                    this.consumeLeaf(1, PipeKeyword, this.grammarAccess.Disjunction.PipeKeyword)
                    this.subruleLeaf(2, this.Conjunction, this.grammarAccess.Disjunction.Right)
            })
        return this.construct<Disjunction>('Disjunction');
    })

    private Conjunction: RuleResult<Conjunction> = this.RULE("Conjunction", () => {
            this.subruleLeaf(1, this.Negation, this.grammarAccess.Conjunction.Left)
            this.option(1, () => {
                    this.consumeLeaf(1, AmpersandKeyword, this.grammarAccess.Conjunction.AmpersandKeyword)
                    this.subruleLeaf(2, this.Negation, this.grammarAccess.Conjunction.Right)
            })
        return this.construct<Conjunction>('Conjunction');
    })

    private Negation: RuleResult<Negation> = this.RULE("Negation", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.Atom, this.grammarAccess.Negation.AtomRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(1, ExclamationMarkKeyword, this.grammarAccess.Negation.ExclamationMarkKeyword)
                        this.subruleLeaf(2, this.Negation, this.grammarAccess.Negation.Value)
                        return this.construct<Negation>('Negation');
                    }
                },
            ])
        return this.construct<Negation>('Negation');
    })

    private Atom = this.RULE("Atom", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.ParameterReference, this.grammarAccess.Atom.ParameterReferenceRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.ParenthesizedCondition, this.grammarAccess.Atom.ParenthesizedConditionRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(3, this.LiteralCondition, this.grammarAccess.Atom.LiteralConditionRuleCall)
                    }
                },
            ])
        return this.construct<Atom>('Atom');
    })

    private ParenthesizedCondition = this.RULE("ParenthesizedCondition", () => {
            this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedCondition.ParenthesisOpenKeyword)
            this.unassignedSubrule(1, this.Disjunction, this.grammarAccess.ParenthesizedCondition.DisjunctionRuleCall)
            this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedCondition.ParenthesisCloseKeyword)
        return this.construct<ParenthesizedCondition>('ParenthesizedCondition');
    })

    private ParameterReference: RuleResult<ParameterReference> = this.RULE("ParameterReference", () => {
            this.consumeLeaf(1, ID, this.grammarAccess.ParameterReference.Parameter)
        return this.construct<ParameterReference>('ParameterReference');
    })

    private TerminalRuleCall: RuleResult<TerminalRuleCall> = this.RULE("TerminalRuleCall", () => {
            this.consumeLeaf(1, ID, this.grammarAccess.TerminalRuleCall.Rule)
        return this.construct<TerminalRuleCall>('TerminalRuleCall');
    })

    private PredicatedKeyword: RuleResult<PredicatedKeyword> = this.RULE("PredicatedKeyword", () => {
                this.or(1, [
                    {
                        ALT: () => {
                            this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedKeyword.Predicated)
                        }
                    },
                    {
                        ALT: () => {
                            this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedKeyword.FirstSetPredicated)
                        }
                    },
                ])

            this.consumeLeaf(3, string, this.grammarAccess.PredicatedKeyword.Value)
        return this.construct<PredicatedKeyword>('PredicatedKeyword');
    })

    private PredicatedRuleCall: RuleResult<PredicatedRuleCall> = this.RULE("PredicatedRuleCall", () => {
                this.or(1, [
                    {
                        ALT: () => {
                            this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedRuleCall.Predicated)
                        }
                    },
                    {
                        ALT: () => {
                            this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedRuleCall.FirstSetPredicated)
                        }
                    },
                ])

            this.consumeLeaf(3, ID, this.grammarAccess.PredicatedRuleCall.Rule)
            this.option(1, () => {
                    this.consumeLeaf(4, LessThanKeyword, this.grammarAccess.PredicatedRuleCall.LessThanKeyword)
                    this.subruleLeaf(1, this.NamedArgument, this.grammarAccess.PredicatedRuleCall.Arguments)
                    this.many(1, () => {
                            this.consumeLeaf(5, CommaKeyword, this.grammarAccess.PredicatedRuleCall.CommaKeyword)
                            this.subruleLeaf(2, this.NamedArgument, this.grammarAccess.PredicatedRuleCall.Arguments)
                    })
                    this.consumeLeaf(6, MoreThanKeyword, this.grammarAccess.PredicatedRuleCall.MoreThanKeyword)
            })
        return this.construct<PredicatedRuleCall>('PredicatedRuleCall');
    })

    private Assignment: RuleResult<Assignment> = this.RULE("Assignment", () => {
            this.option(1, () => {
                    this.or(1, [
                        {
                            ALT: () => {
                                this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.Assignment.Predicated)
                            }
                        },
                        {
                            ALT: () => {
                                this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.Assignment.FirstSetPredicated)
                            }
                        },
                    ])
            })
            this.consumeLeaf(3, ID, this.grammarAccess.Assignment.Feature)
            this.or(2, [
            { ALT: () => {
            this.consumeLeaf(4, PlusEqualsKeyword, this.grammarAccess.Assignment.Operator)
            }},
            { ALT: () => {
            this.consumeLeaf(5, EqualsKeyword, this.grammarAccess.Assignment.Operator)
            }},
            { ALT: () => {
            this.consumeLeaf(6, QuestionMarkEqualsKeyword, this.grammarAccess.Assignment.Operator)
            }},
            ])
            this.subruleLeaf(1, this.AssignableTerminal, this.grammarAccess.Assignment.Terminal)
        return this.construct<Assignment>('Assignment');
    })

    private AssignableTerminal = this.RULE("AssignableTerminal", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.Keyword, this.grammarAccess.AssignableTerminal.KeywordRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.RuleCall, this.grammarAccess.AssignableTerminal.RuleCallRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(3, this.ParenthesizedAssignableElement, this.grammarAccess.AssignableTerminal.ParenthesizedAssignableElementRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(4, this.CrossReference, this.grammarAccess.AssignableTerminal.CrossReferenceRuleCall)
                    }
                },
            ])
        return this.construct<AssignableTerminal>('AssignableTerminal');
    })

    private ParenthesizedAssignableElement: RuleResult<ParenthesizedAssignableElement> = this.RULE("ParenthesizedAssignableElement", () => {
            this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedAssignableElement.ParenthesisOpenKeyword)
            this.subruleLeaf(1, this.AssignableAlternatives, this.grammarAccess.ParenthesizedAssignableElement.Alternatives)
            this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedAssignableElement.ParenthesisCloseKeyword)
        return this.construct<ParenthesizedAssignableElement>('ParenthesizedAssignableElement');
    })

    private AssignableAlternatives: RuleResult<AssignableAlternatives> = this.RULE("AssignableAlternatives", () => {
            this.subruleLeaf(1, this.AssignableTerminal, this.grammarAccess.AssignableAlternatives.Elements)
            this.many(1, () => {
                    this.consumeLeaf(1, PipeKeyword, this.grammarAccess.AssignableAlternatives.PipeKeyword)
                    this.subruleLeaf(2, this.AssignableTerminal, this.grammarAccess.AssignableAlternatives.Elements)
            })
        return this.construct<AssignableAlternatives>('AssignableAlternatives');
    })

    private CrossReference: RuleResult<CrossReference> = this.RULE("CrossReference", () => {
            this.consumeLeaf(1, BracketOpenKeyword, this.grammarAccess.CrossReference.BracketOpenKeyword)
            this.consumeLeaf(2, ID, this.grammarAccess.CrossReference.Type)
            this.option(1, () => {
                    this.consumeLeaf(3, PipeKeyword, this.grammarAccess.CrossReference.PipeKeyword)
                    this.subruleLeaf(1, this.CrossReferenceableTerminal, this.grammarAccess.CrossReference.Terminal)
            })
            this.consumeLeaf(4, BracketCloseKeyword, this.grammarAccess.CrossReference.BracketCloseKeyword)
        return this.construct<CrossReference>('CrossReference');
    })

    private CrossReferenceableTerminal = this.RULE("CrossReferenceableTerminal", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.Keyword, this.grammarAccess.CrossReferenceableTerminal.KeywordRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.RuleCall, this.grammarAccess.CrossReferenceableTerminal.RuleCallRuleCall)
                    }
                },
            ])
        return this.construct<CrossReferenceableTerminal>('CrossReferenceableTerminal');
    })

    private ParenthesizedElement: RuleResult<ParenthesizedElement> = this.RULE("ParenthesizedElement", () => {
            this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedElement.ParenthesisOpenKeyword)
            this.subruleLeaf(1, this.Alternatives, this.grammarAccess.ParenthesizedElement.Alternatives)
            this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedElement.ParenthesisCloseKeyword)
        return this.construct<ParenthesizedElement>('ParenthesizedElement');
    })

    private PredicatedGroup: RuleResult<PredicatedGroup> = this.RULE("PredicatedGroup", () => {
                this.or(1, [
                    {
                        ALT: () => {
                            this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedGroup.Predicated)
                        }
                    },
                    {
                        ALT: () => {
                            this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedGroup.FirstSetPredicated)
                        }
                    },
                ])

            this.consumeLeaf(3, ParenthesisOpenKeyword, this.grammarAccess.PredicatedGroup.ParenthesisOpenKeyword)
            this.subruleLeaf(1, this.Alternatives, this.grammarAccess.PredicatedGroup.Elements)
            this.consumeLeaf(4, ParenthesisCloseKeyword, this.grammarAccess.PredicatedGroup.ParenthesisCloseKeyword)
        return this.construct<PredicatedGroup>('PredicatedGroup');
    })

    private TerminalRule: RuleResult<TerminalRule> = this.RULE("TerminalRule", () => {
            this.consumeLeaf(1, TerminalKeyword, this.grammarAccess.TerminalRule.TerminalKeyword)
                this.or(1, [
                    {
                        ALT: () => {
                            this.consumeLeaf(2, FragmentKeyword, this.grammarAccess.TerminalRule.Fragment)
                            this.consumeLeaf(3, ID, this.grammarAccess.TerminalRule.Name)
                        }
                    },
                    {
                        ALT: () => {
                            this.consumeLeaf(4, ID, this.grammarAccess.TerminalRule.Name)
                            this.option(1, () => {
                                    this.consumeLeaf(5, ReturnsKeyword, this.grammarAccess.TerminalRule.ReturnsKeyword)
                                    this.consumeLeaf(6, ID, this.grammarAccess.TerminalRule.Type)
                            })
                        }
                    },
                ])

            this.consumeLeaf(7, ColonKeyword, this.grammarAccess.TerminalRule.ColonKeyword)
            this.consumeLeaf(8, RegexLiteral, this.grammarAccess.TerminalRule.Regex)
            this.consumeLeaf(9, SemicolonKeyword, this.grammarAccess.TerminalRule.SemicolonKeyword)
        return this.construct<TerminalRule>('TerminalRule');
    })

    private TerminalAlternatives: RuleResult<TerminalAlternatives> = this.RULE("TerminalAlternatives", () => {
            this.subruleLeaf(1, this.TerminalGroup, this.grammarAccess.TerminalAlternatives.Elements)
            this.many(1, () => {
                    this.consumeLeaf(1, PipeKeyword, this.grammarAccess.TerminalAlternatives.PipeKeyword)
                    this.subruleLeaf(2, this.TerminalGroup, this.grammarAccess.TerminalAlternatives.Elements)
            })
        return this.construct<TerminalAlternatives>('TerminalAlternatives');
    })

    private TerminalGroup: RuleResult<TerminalGroup> = this.RULE("TerminalGroup", () => {
            this.many(1, () => {
                this.subruleLeaf(1, this.TerminalToken, this.grammarAccess.TerminalGroup.Elements)})
        return this.construct<TerminalGroup>('TerminalGroup');
    })

    private TerminalToken: RuleResult<TerminalToken> = this.RULE("TerminalToken", () => {
            this.unassignedSubrule(1, this.TerminalTokenElement, this.grammarAccess.TerminalToken.TerminalTokenElementRuleCall)
            this.option(1, () => {
                this.or(1, [
                { ALT: () => {
                this.consumeLeaf(1, QuestionMarkKeyword, this.grammarAccess.TerminalToken.Cardinality)
                }},
                { ALT: () => {
                this.consumeLeaf(2, AsteriskKeyword, this.grammarAccess.TerminalToken.Cardinality)
                }},
                { ALT: () => {
                this.consumeLeaf(3, PlusKeyword, this.grammarAccess.TerminalToken.Cardinality)
                }},
                ])})
        return this.construct<TerminalToken>('TerminalToken');
    })

    private TerminalTokenElement = this.RULE("TerminalTokenElement", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.CharacterRange, this.grammarAccess.TerminalTokenElement.CharacterRangeRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.TerminalRuleCall, this.grammarAccess.TerminalTokenElement.TerminalRuleCallRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(3, this.ParenthesizedTerminalElement, this.grammarAccess.TerminalTokenElement.ParenthesizedTerminalElementRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(4, this.AbstractNegatedToken, this.grammarAccess.TerminalTokenElement.AbstractNegatedTokenRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(5, this.Wildcard, this.grammarAccess.TerminalTokenElement.WildcardRuleCall)
                    }
                },
            ])
        return this.construct<TerminalTokenElement>('TerminalTokenElement');
    })

    private ParenthesizedTerminalElement = this.RULE("ParenthesizedTerminalElement", () => {
            this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedTerminalElement.ParenthesisOpenKeyword)
            this.unassignedSubrule(1, this.TerminalAlternatives, this.grammarAccess.ParenthesizedTerminalElement.TerminalAlternativesRuleCall)
            this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedTerminalElement.ParenthesisCloseKeyword)
        return this.construct<ParenthesizedTerminalElement>('ParenthesizedTerminalElement');
    })

    private AbstractNegatedToken = this.RULE("AbstractNegatedToken", () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.unassignedSubrule(1, this.NegatedToken, this.grammarAccess.AbstractNegatedToken.NegatedTokenRuleCall)
                    }
                },
                {
                    ALT: () => {
                        this.unassignedSubrule(2, this.UntilToken, this.grammarAccess.AbstractNegatedToken.UntilTokenRuleCall)
                    }
                },
            ])
        return this.construct<AbstractNegatedToken>('AbstractNegatedToken');
    })

    private NegatedToken: RuleResult<NegatedToken> = this.RULE("NegatedToken", () => {
            this.consumeLeaf(1, ExclamationMarkKeyword, this.grammarAccess.NegatedToken.ExclamationMarkKeyword)
            this.subruleLeaf(1, this.TerminalTokenElement, this.grammarAccess.NegatedToken.Terminal)
        return this.construct<NegatedToken>('NegatedToken');
    })

    private UntilToken: RuleResult<UntilToken> = this.RULE("UntilToken", () => {
            this.consumeLeaf(1, DashMoreThanKeyword, this.grammarAccess.UntilToken.DashMoreThanKeyword)
            this.subruleLeaf(1, this.TerminalTokenElement, this.grammarAccess.UntilToken.Terminal)
        return this.construct<UntilToken>('UntilToken');
    })

    private Wildcard = this.RULE("Wildcard", () => {
            this.consumeLeaf(1, DotKeyword, this.grammarAccess.Wildcard.DotKeyword)
        return this.construct<Wildcard>('Wildcard');
    })

    private CharacterRange: RuleResult<CharacterRange> = this.RULE("CharacterRange", () => {
            this.subruleLeaf(1, this.Keyword, this.grammarAccess.CharacterRange.Left)
            this.option(1, () => {
                    this.consumeLeaf(1, DotDotKeyword, this.grammarAccess.CharacterRange.DotDotKeyword)
                    this.subruleLeaf(2, this.Keyword, this.grammarAccess.CharacterRange.Right)
            })
        return this.construct<CharacterRange>('CharacterRange');
    })

    private EnumRule: RuleResult<EnumRule> = this.RULE("EnumRule", () => {
            this.consumeLeaf(1, EnumKeyword, this.grammarAccess.EnumRule.EnumKeyword)
            this.consumeLeaf(2, ID, this.grammarAccess.EnumRule.Name)
            this.option(1, () => {
                    this.consumeLeaf(3, ReturnsKeyword, this.grammarAccess.EnumRule.ReturnsKeyword)
                    this.consumeLeaf(4, ID, this.grammarAccess.EnumRule.Type)
            })
            this.consumeLeaf(5, ColonKeyword, this.grammarAccess.EnumRule.ColonKeyword)
            this.subruleLeaf(1, this.EnumLiterals, this.grammarAccess.EnumRule.Alternatives)
            this.consumeLeaf(6, SemicolonKeyword, this.grammarAccess.EnumRule.SemicolonKeyword)
        return this.construct<EnumRule>('EnumRule');
    })

    private EnumLiterals: RuleResult<EnumLiterals> = this.RULE("EnumLiterals", () => {
            this.subruleLeaf(1, this.EnumLiteralDeclaration, this.grammarAccess.EnumLiterals.Elements)
            this.many(1, () => {
                    this.consumeLeaf(1, PipeKeyword, this.grammarAccess.EnumLiterals.PipeKeyword)
                    this.subruleLeaf(2, this.EnumLiteralDeclaration, this.grammarAccess.EnumLiterals.Elements)
            })
        return this.construct<EnumLiterals>('EnumLiterals');
    })

    private EnumLiteralDeclaration: RuleResult<EnumLiteralDeclaration> = this.RULE("EnumLiteralDeclaration", () => {
            this.consumeLeaf(1, ID, this.grammarAccess.EnumLiteralDeclaration.EnumLiteral)
            this.option(1, () => {
                    this.consumeLeaf(2, EqualsKeyword, this.grammarAccess.EnumLiteralDeclaration.EqualsKeyword)
                    this.subruleLeaf(1, this.Keyword, this.grammarAccess.EnumLiteralDeclaration.Literal)
            })
        return this.construct<EnumLiteralDeclaration>('EnumLiteralDeclaration');
    })


}

let parser: Parser | undefined;

export function parse(grammar: Grammar, text: string) {
    if (!parser) {
        parser = new Parser(grammar);
    }
    const lexResult = lexer.tokenize(text);
    parser.input = lexResult.tokens;
    const ast = parser.Grammar();
    (ast[AstNode.node] as RootNode).setText(text);
    return {
        ast,
        lexErrors: lexResult.errors,
        parseErrors: parser.errors
    }
}
