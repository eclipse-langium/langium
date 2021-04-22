/* eslint-disable */
// @ts-nocheck
import { createToken, Lexer } from 'chevrotain';
import { LangiumParser } from '../index';
import { LangiumGrammarAccess } from './grammar-access';
import { Grammar, GeneratedMetamodel, ReferencedMetamodel, Annotation, ParserRule, Parameter, Alternatives, UnorderedGroup, Group, AbstractElement, Action, Keyword, RuleCall, NamedArgument, LiteralCondition, Disjunction, Conjunction, Negation, ParameterReference, TerminalRuleCall, Assignment, CrossReference, TerminalRule, TerminalAlternatives, TerminalGroup, TerminalToken, NegatedToken, UntilToken, Wildcard, CharacterRange, EnumRule, EnumLiterals, EnumLiteralDeclaration, AbstractRule, AbstractMetamodelDeclaration, Condition, TerminalTokenElement, ParenthesizedTerminalElement, AbstractNegatedToken, } from './ast';

const WS = createToken({ name : 'WS', pattern: /\s+/, group: Lexer.SKIPPED });
const ID = createToken({ name : 'ID', pattern: /\^?[_a-zA-Z][\w_]*/ });
const INT = createToken({ name : 'INT', pattern: /[0-9]+/ });
const string = createToken({ name : 'string', pattern: /"[^"]*"|'[^']*'/ });
const RegexLiteral = createToken({ name : 'RegexLiteral', pattern: /\/(?![*+?])(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\// });
const GenerateKeyword = createToken({ name: 'GenerateKeyword', pattern: /generate/, longer_alt: ID });
const FragmentKeyword = createToken({ name: 'FragmentKeyword', pattern: /fragment/, longer_alt: ID });
const TerminalKeyword = createToken({ name: 'TerminalKeyword', pattern: /terminal/, longer_alt: ID });
const GrammarKeyword = createToken({ name: 'GrammarKeyword', pattern: /grammar/, longer_alt: ID });
const ReturnsKeyword = createToken({ name: 'ReturnsKeyword', pattern: /returns/, longer_alt: ID });
const CurrentKeyword = createToken({ name: 'CurrentKeyword', pattern: /current/, longer_alt: ID });
const HiddenKeyword = createToken({ name: 'HiddenKeyword', pattern: /hidden/, longer_alt: ID });
const ImportKeyword = createToken({ name: 'ImportKeyword', pattern: /import/, longer_alt: ID });
const FalseKeyword = createToken({ name: 'FalseKeyword', pattern: /false/, longer_alt: ID });
const WithKeyword = createToken({ name: 'WithKeyword', pattern: /with/, longer_alt: ID });
const TrueKeyword = createToken({ name: 'TrueKeyword', pattern: /true/, longer_alt: ID });
const EnumKeyword = createToken({ name: 'EnumKeyword', pattern: /enum/, longer_alt: ID });
const AsKeyword = createToken({ name: 'AsKeyword', pattern: /as/, longer_alt: ID });
const PlusEqualsKeyword = createToken({ name: 'PlusEqualsKeyword', pattern: /\+=/, longer_alt: ID });
const EqualsMoreThanKeyword = createToken({ name: 'EqualsMoreThanKeyword', pattern: /=>/, longer_alt: ID });
const DashMoreThanKeyword = createToken({ name: 'DashMoreThanKeyword', pattern: /->/, longer_alt: ID });
const QuestionMarkEqualsKeyword = createToken({ name: 'QuestionMarkEqualsKeyword', pattern: /\?=/, longer_alt: ID });
const DotDotKeyword = createToken({ name: 'DotDotKeyword', pattern: /\.\./, longer_alt: ID });
const CommaKeyword = createToken({ name: 'CommaKeyword', pattern: /,/, longer_alt: ID });
const ParenthesisOpenKeyword = createToken({ name: 'ParenthesisOpenKeyword', pattern: /\(/, longer_alt: ID });
const ParenthesisCloseKeyword = createToken({ name: 'ParenthesisCloseKeyword', pattern: /\)/, longer_alt: ID });
const AtKeyword = createToken({ name: 'AtKeyword', pattern: /@/, longer_alt: ID });
const AsteriskKeyword = createToken({ name: 'AsteriskKeyword', pattern: /\*/, longer_alt: ID });
const ColonKeyword = createToken({ name: 'ColonKeyword', pattern: /:/, longer_alt: ID });
const SemicolonKeyword = createToken({ name: 'SemicolonKeyword', pattern: /;/, longer_alt: ID });
const LessThanKeyword = createToken({ name: 'LessThanKeyword', pattern: /</, longer_alt: ID });
const MoreThanKeyword = createToken({ name: 'MoreThanKeyword', pattern: />/, longer_alt: ID });
const PipeKeyword = createToken({ name: 'PipeKeyword', pattern: /\|/, longer_alt: ID });
const AmpersandKeyword = createToken({ name: 'AmpersandKeyword', pattern: /&/, longer_alt: ID });
const QuestionMarkKeyword = createToken({ name: 'QuestionMarkKeyword', pattern: /\?/, longer_alt: QuestionMarkEqualsKeyword });
const PlusKeyword = createToken({ name: 'PlusKeyword', pattern: /\+/, longer_alt: PlusEqualsKeyword });
const CurlyOpenKeyword = createToken({ name: 'CurlyOpenKeyword', pattern: /\{/, longer_alt: ID });
const DotKeyword = createToken({ name: 'DotKeyword', pattern: /\./, longer_alt: DotDotKeyword });
const EqualsKeyword = createToken({ name: 'EqualsKeyword', pattern: /=/, longer_alt: EqualsMoreThanKeyword });
const CurlyCloseKeyword = createToken({ name: 'CurlyCloseKeyword', pattern: /\}/, longer_alt: ID });
const ExclamationMarkKeyword = createToken({ name: 'ExclamationMarkKeyword', pattern: /!/, longer_alt: ID });
const BracketOpenKeyword = createToken({ name: 'BracketOpenKeyword', pattern: /\[/, longer_alt: ID });
const BracketCloseKeyword = createToken({ name: 'BracketCloseKeyword', pattern: /\]/, longer_alt: ID });

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
AsteriskKeyword.LABEL = "'*'";
ReturnsKeyword.LABEL = "'returns'";
ColonKeyword.LABEL = "':'";
SemicolonKeyword.LABEL = "';'";
LessThanKeyword.LABEL = "'<'";
MoreThanKeyword.LABEL = "'>'";
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
const tokens = [GenerateKeyword, FragmentKeyword, TerminalKeyword, GrammarKeyword, ReturnsKeyword, CurrentKeyword, HiddenKeyword, ImportKeyword, FalseKeyword, WithKeyword, TrueKeyword, EnumKeyword, AsKeyword, PlusEqualsKeyword, EqualsMoreThanKeyword, DashMoreThanKeyword, QuestionMarkEqualsKeyword, DotDotKeyword, CommaKeyword, ParenthesisOpenKeyword, ParenthesisCloseKeyword, AtKeyword, AsteriskKeyword, ColonKeyword, SemicolonKeyword, LessThanKeyword, MoreThanKeyword, PipeKeyword, AmpersandKeyword, QuestionMarkKeyword, PlusKeyword, CurlyOpenKeyword, DotKeyword, EqualsKeyword, CurlyCloseKeyword, ExclamationMarkKeyword, BracketOpenKeyword, BracketCloseKeyword, WS, ID, INT, string, RegexLiteral];

const lexer = new Lexer(tokens);
export class Parser extends LangiumParser {
    grammarAccess: LangiumGrammarAccess;
    constructor(grammarAccess: LangiumGrammarAccess) {
        super(tokens);
        this.grammarAccess = grammarAccess;
        this.performSelfAnalysis();
    }

    private Grammar = this.MAIN_RULE("Grammar", Grammar.kind, () => {
        this.consumeLeaf(1, GrammarKeyword, this.grammarAccess.Grammar.GrammarKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.Grammar.name);
        this.option(1, () => {
            this.consumeLeaf(3, WithKeyword, this.grammarAccess.Grammar.WithKeyword);
            this.consumeLeaf(4, ID, this.grammarAccess.Grammar.usedGrammars);
            this.many(1, () => {
                this.consumeLeaf(5, CommaKeyword, this.grammarAccess.Grammar.CommaKeyword);
                this.consumeLeaf(6, ID, this.grammarAccess.Grammar.usedGrammars);
            });
        });
        this.option(3, () => {
            this.consumeLeaf(7, HiddenKeyword, this.grammarAccess.Grammar.definesHiddenTokens);
            this.consumeLeaf(8, ParenthesisOpenKeyword, this.grammarAccess.Grammar.ParenthesisOpenKeyword);
            this.option(2, () => {
                this.consumeLeaf(9, ID, this.grammarAccess.Grammar.hiddenTokens);
                this.many(2, () => {
                    this.consumeLeaf(10, CommaKeyword, this.grammarAccess.Grammar.CommaKeyword);
                    this.consumeLeaf(11, ID, this.grammarAccess.Grammar.hiddenTokens);
                });
            });
            this.consumeLeaf(12, ParenthesisCloseKeyword, this.grammarAccess.Grammar.ParenthesisCloseKeyword);
        });
        this.many(3, () => {
            this.subruleLeaf(1, this.AbstractMetamodelDeclaration, this.grammarAccess.Grammar.metamodelDeclarations);
        });
        this.many(4, () => {
            this.subruleLeaf(2, this.AbstractRule, this.grammarAccess.Grammar.rules);
        });
        return this.construct<Grammar>();
    })

    private AbstractRule = this.DEFINE_RULE("AbstractRule", AbstractRule.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.ParserRule, this.grammarAccess.AbstractRule.ParserRuleRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.TerminalRule, this.grammarAccess.AbstractRule.TerminalRuleRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(3, this.EnumRule, this.grammarAccess.AbstractRule.EnumRuleRuleCall);
                }
            },
        ]);
        return this.construct<AbstractRule>();
    })

    private AbstractMetamodelDeclaration = this.DEFINE_RULE("AbstractMetamodelDeclaration", AbstractMetamodelDeclaration.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.GeneratedMetamodel, this.grammarAccess.AbstractMetamodelDeclaration.GeneratedMetamodelRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.ReferencedMetamodel, this.grammarAccess.AbstractMetamodelDeclaration.ReferencedMetamodelRuleCall);
                }
            },
        ]);
        return this.construct<AbstractMetamodelDeclaration>();
    })

    private GeneratedMetamodel = this.DEFINE_RULE("GeneratedMetamodel", GeneratedMetamodel.kind, () => {
        this.consumeLeaf(1, GenerateKeyword, this.grammarAccess.GeneratedMetamodel.GenerateKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.GeneratedMetamodel.name);
        this.consumeLeaf(3, ID, this.grammarAccess.GeneratedMetamodel.ePackage);
        this.option(1, () => {
            this.consumeLeaf(4, AsKeyword, this.grammarAccess.GeneratedMetamodel.AsKeyword);
            this.consumeLeaf(5, ID, this.grammarAccess.GeneratedMetamodel.alias);
        });
        return this.construct<GeneratedMetamodel>();
    })

    private ReferencedMetamodel = this.DEFINE_RULE("ReferencedMetamodel", ReferencedMetamodel.kind, () => {
        this.consumeLeaf(1, ImportKeyword, this.grammarAccess.ReferencedMetamodel.ImportKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.ReferencedMetamodel.ePackage);
        this.option(1, () => {
            this.consumeLeaf(3, AsKeyword, this.grammarAccess.ReferencedMetamodel.AsKeyword);
            this.consumeLeaf(4, ID, this.grammarAccess.ReferencedMetamodel.alias);
        });
        return this.construct<ReferencedMetamodel>();
    })

    private Annotation = this.DEFINE_RULE("Annotation", Annotation.kind, () => {
        this.consumeLeaf(1, AtKeyword, this.grammarAccess.Annotation.AtKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.Annotation.name);
        return this.construct<Annotation>();
    })

    private ParserRule = this.DEFINE_RULE("ParserRule", ParserRule.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, FragmentKeyword, this.grammarAccess.ParserRule.fragment);
                    this.unassignedSubrule(1, this.RuleNameAndParams, this.grammarAccess.ParserRule.RuleNameAndParamsRuleCall);
                    this.or(2, [
                        {
                            ALT: () => {
                                this.consumeLeaf(2, AsteriskKeyword, this.grammarAccess.ParserRule.wildcard);
                            }
                        },
                        {
                            ALT: () => {
                                this.option(1, () => {
                                    this.consumeLeaf(3, ReturnsKeyword, this.grammarAccess.ParserRule.ReturnsKeyword);
                                    this.consumeLeaf(4, ID, this.grammarAccess.ParserRule.type);
                                });
                            }
                        },
                    ]);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.RuleNameAndParams, this.grammarAccess.ParserRule.RuleNameAndParamsRuleCall);
                    this.option(2, () => {
                        this.consumeLeaf(5, ReturnsKeyword, this.grammarAccess.ParserRule.ReturnsKeyword);
                        this.consumeLeaf(6, ID, this.grammarAccess.ParserRule.type);
                    });
                }
            },
        ]);
        this.option(4, () => {
            this.consumeLeaf(7, HiddenKeyword, this.grammarAccess.ParserRule.definesHiddenTokens);
            this.consumeLeaf(8, ParenthesisOpenKeyword, this.grammarAccess.ParserRule.ParenthesisOpenKeyword);
            this.option(3, () => {
                this.consumeLeaf(9, ID, this.grammarAccess.ParserRule.hiddenTokens);
                this.many(1, () => {
                    this.consumeLeaf(10, CommaKeyword, this.grammarAccess.ParserRule.CommaKeyword);
                    this.consumeLeaf(11, ID, this.grammarAccess.ParserRule.hiddenTokens);
                });
            });
            this.consumeLeaf(12, ParenthesisCloseKeyword, this.grammarAccess.ParserRule.ParenthesisCloseKeyword);
        });
        this.consumeLeaf(13, ColonKeyword, this.grammarAccess.ParserRule.ColonKeyword);
        this.subruleLeaf(3, this.Alternatives, this.grammarAccess.ParserRule.alternatives);
        this.consumeLeaf(14, SemicolonKeyword, this.grammarAccess.ParserRule.SemicolonKeyword);
        return this.construct<ParserRule>();
    })

    private RuleNameAndParams = this.DEFINE_RULE("RuleNameAndParams", undefined, () => {
        this.consumeLeaf(1, ID, this.grammarAccess.RuleNameAndParams.name);
        this.option(2, () => {
            this.consumeLeaf(2, LessThanKeyword, this.grammarAccess.RuleNameAndParams.LessThanKeyword);
            this.option(1, () => {
                this.subruleLeaf(1, this.Parameter, this.grammarAccess.RuleNameAndParams.parameters);
                this.many(1, () => {
                    this.consumeLeaf(3, CommaKeyword, this.grammarAccess.RuleNameAndParams.CommaKeyword);
                    this.subruleLeaf(2, this.Parameter, this.grammarAccess.RuleNameAndParams.parameters);
                });
            });
            this.consumeLeaf(4, MoreThanKeyword, this.grammarAccess.RuleNameAndParams.MoreThanKeyword);
        });
        return this.construct<RuleNameAndParams>();
    })

    private Parameter = this.DEFINE_RULE("Parameter", Parameter.kind, () => {
        this.consumeLeaf(1, ID, this.grammarAccess.Parameter.name);
        return this.construct<Parameter>();
    })

    private Alternatives = this.DEFINE_RULE("Alternatives", AbstractElement.kind, () => {
        this.unassignedSubrule(1, this.UnorderedGroup, this.grammarAccess.Alternatives.UnorderedGroupRuleCall);
        this.many(1, () => {
            this.executeAction(Alternatives.kind, this.grammarAccess.Alternatives.AlternativeselementsAction);
            this.consumeLeaf(1, PipeKeyword, this.grammarAccess.Alternatives.PipeKeyword);
            this.subruleLeaf(2, this.UnorderedGroup, this.grammarAccess.Alternatives.elements);
        });
        return this.construct<AbstractElement>();
    })

    private UnorderedGroup = this.DEFINE_RULE("UnorderedGroup", AbstractElement.kind, () => {
        this.unassignedSubrule(1, this.Group, this.grammarAccess.UnorderedGroup.GroupRuleCall);
        this.many(1, () => {
            this.executeAction(UnorderedGroup.kind, this.grammarAccess.UnorderedGroup.UnorderedGroupelementsAction);
            this.consumeLeaf(1, AmpersandKeyword, this.grammarAccess.UnorderedGroup.AmpersandKeyword);
            this.subruleLeaf(2, this.Group, this.grammarAccess.UnorderedGroup.elements);
        });
        return this.construct<AbstractElement>();
    })

    private Group = this.DEFINE_RULE("Group", AbstractElement.kind, () => {
        this.unassignedSubrule(1, this.AbstractToken, this.grammarAccess.Group.AbstractTokenRuleCall);
        this.many(1, () => {
            this.executeAction(Group.kind, this.grammarAccess.Group.GroupelementsAction);
            this.subruleLeaf(2, this.AbstractToken, this.grammarAccess.Group.elements);
        });
        return this.construct<AbstractElement>();
    })

    private AbstractToken = this.DEFINE_RULE("AbstractToken", AbstractElement.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.AbstractTokenWithCardinality, this.grammarAccess.AbstractToken.AbstractTokenWithCardinalityRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.Action, this.grammarAccess.AbstractToken.ActionRuleCall);
                }
            },
        ]);
        return this.construct<AbstractElement>();
    })

    private AbstractTokenWithCardinality = this.DEFINE_RULE("AbstractTokenWithCardinality", AbstractElement.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.Assignment, this.grammarAccess.AbstractTokenWithCardinality.AssignmentRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.AbstractTerminal, this.grammarAccess.AbstractTokenWithCardinality.AbstractTerminalRuleCall);
                }
            },
        ]);
        this.option(1, () => {
            this.or(2, [
                {
                    ALT: () => {
                        this.consumeLeaf(1, QuestionMarkKeyword, this.grammarAccess.AbstractTokenWithCardinality.cardinality);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(2, AsteriskKeyword, this.grammarAccess.AbstractTokenWithCardinality.cardinality);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(3, PlusKeyword, this.grammarAccess.AbstractTokenWithCardinality.cardinality);
                    }
                },
            ]);
        });
        return this.construct<AbstractElement>();
    })

    private Action = this.DEFINE_RULE("Action", AbstractElement.kind, () => {
        this.executeAction(Action.kind, this.grammarAccess.Action.ActionAction);
        this.consumeLeaf(1, CurlyOpenKeyword, this.grammarAccess.Action.CurlyOpenKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.Action.type);
        this.option(1, () => {
            this.consumeLeaf(3, DotKeyword, this.grammarAccess.Action.DotKeyword);
            this.consumeLeaf(4, ID, this.grammarAccess.Action.feature);
            this.or(1, [
                {
                    ALT: () => {
                        this.consumeLeaf(5, EqualsKeyword, this.grammarAccess.Action.operator);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(6, PlusEqualsKeyword, this.grammarAccess.Action.operator);
                    }
                },
            ]);
            this.consumeLeaf(7, CurrentKeyword, this.grammarAccess.Action.CurrentKeyword);
        });
        this.consumeLeaf(8, CurlyCloseKeyword, this.grammarAccess.Action.CurlyCloseKeyword);
        return this.construct<AbstractElement>();
    })

    private AbstractTerminal = this.DEFINE_RULE("AbstractTerminal", AbstractElement.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.Keyword, this.grammarAccess.AbstractTerminal.KeywordRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.RuleCall, this.grammarAccess.AbstractTerminal.RuleCallRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(3, this.ParenthesizedElement, this.grammarAccess.AbstractTerminal.ParenthesizedElementRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(4, this.PredicatedKeyword, this.grammarAccess.AbstractTerminal.PredicatedKeywordRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(5, this.PredicatedRuleCall, this.grammarAccess.AbstractTerminal.PredicatedRuleCallRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(6, this.PredicatedGroup, this.grammarAccess.AbstractTerminal.PredicatedGroupRuleCall);
                }
            },
        ]);
        return this.construct<AbstractElement>();
    })

    private Keyword = this.DEFINE_RULE("Keyword", Keyword.kind, () => {
        this.consumeLeaf(1, string, this.grammarAccess.Keyword.value);
        return this.construct<Keyword>();
    })

    private RuleCall = this.DEFINE_RULE("RuleCall", RuleCall.kind, () => {
        this.consumeLeaf(1, ID, this.grammarAccess.RuleCall.rule);
        this.option(1, () => {
            this.consumeLeaf(2, LessThanKeyword, this.grammarAccess.RuleCall.LessThanKeyword);
            this.subruleLeaf(1, this.NamedArgument, this.grammarAccess.RuleCall.arguments);
            this.many(1, () => {
                this.consumeLeaf(3, CommaKeyword, this.grammarAccess.RuleCall.CommaKeyword);
                this.subruleLeaf(2, this.NamedArgument, this.grammarAccess.RuleCall.arguments);
            });
            this.consumeLeaf(4, MoreThanKeyword, this.grammarAccess.RuleCall.MoreThanKeyword);
        });
        return this.construct<RuleCall>();
    })

    private NamedArgument = this.DEFINE_RULE("NamedArgument", NamedArgument.kind, () => {
        this.option(1, () => {
            this.consumeLeaf(1, ID, this.grammarAccess.NamedArgument.parameter);
            this.consumeLeaf(2, EqualsKeyword, this.grammarAccess.NamedArgument.calledByName);
        });
        this.subruleLeaf(1, this.Disjunction, this.grammarAccess.NamedArgument.value);
        return this.construct<NamedArgument>();
    })

    private LiteralCondition = this.DEFINE_RULE("LiteralCondition", LiteralCondition.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, TrueKeyword, this.grammarAccess.LiteralCondition.true);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(2, FalseKeyword, this.grammarAccess.LiteralCondition.FalseKeyword);
                }
            },
        ]);
        return this.construct<LiteralCondition>();
    })

    private Disjunction = this.DEFINE_RULE("Disjunction", Condition.kind, () => {
        this.unassignedSubrule(1, this.Conjunction, this.grammarAccess.Disjunction.ConjunctionRuleCall);
        this.option(1, () => {
            this.executeAction(Disjunction.kind, this.grammarAccess.Disjunction.DisjunctionleftAction);
            this.consumeLeaf(1, PipeKeyword, this.grammarAccess.Disjunction.PipeKeyword);
            this.subruleLeaf(2, this.Conjunction, this.grammarAccess.Disjunction.right);
        });
        return this.construct<Condition>();
    })

    private Conjunction = this.DEFINE_RULE("Conjunction", Condition.kind, () => {
        this.unassignedSubrule(1, this.Negation, this.grammarAccess.Conjunction.NegationRuleCall);
        this.option(1, () => {
            this.executeAction(Conjunction.kind, this.grammarAccess.Conjunction.ConjunctionleftAction);
            this.consumeLeaf(1, AmpersandKeyword, this.grammarAccess.Conjunction.AmpersandKeyword);
            this.subruleLeaf(2, this.Negation, this.grammarAccess.Conjunction.right);
        });
        return this.construct<Condition>();
    })

    private Negation = this.DEFINE_RULE("Negation", Condition.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.Atom, this.grammarAccess.Negation.AtomRuleCall);
                }
            },
            {
                ALT: () => {
                    this.executeAction(Negation.kind, this.grammarAccess.Negation.NegationAction);
                    this.consumeLeaf(1, ExclamationMarkKeyword, this.grammarAccess.Negation.ExclamationMarkKeyword);
                    this.subruleLeaf(2, this.Negation, this.grammarAccess.Negation.value);
                }
            },
        ]);
        return this.construct<Condition>();
    })

    private Atom = this.DEFINE_RULE("Atom", Condition.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.ParameterReference, this.grammarAccess.Atom.ParameterReferenceRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.ParenthesizedCondition, this.grammarAccess.Atom.ParenthesizedConditionRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(3, this.LiteralCondition, this.grammarAccess.Atom.LiteralConditionRuleCall);
                }
            },
        ]);
        return this.construct<Condition>();
    })

    private ParenthesizedCondition = this.DEFINE_RULE("ParenthesizedCondition", Condition.kind, () => {
        this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedCondition.ParenthesisOpenKeyword);
        this.unassignedSubrule(1, this.Disjunction, this.grammarAccess.ParenthesizedCondition.DisjunctionRuleCall);
        this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedCondition.ParenthesisCloseKeyword);
        return this.construct<Condition>();
    })

    private ParameterReference = this.DEFINE_RULE("ParameterReference", ParameterReference.kind, () => {
        this.consumeLeaf(1, ID, this.grammarAccess.ParameterReference.parameter);
        return this.construct<ParameterReference>();
    })

    private TerminalRuleCall = this.DEFINE_RULE("TerminalRuleCall", TerminalRuleCall.kind, () => {
        this.consumeLeaf(1, ID, this.grammarAccess.TerminalRuleCall.rule);
        return this.construct<TerminalRuleCall>();
    })

    private PredicatedKeyword = this.DEFINE_RULE("PredicatedKeyword", Keyword.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedKeyword.predicated);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedKeyword.firstSetPredicated);
                }
            },
        ]);
        this.consumeLeaf(3, string, this.grammarAccess.PredicatedKeyword.value);
        return this.construct<Keyword>();
    })

    private PredicatedRuleCall = this.DEFINE_RULE("PredicatedRuleCall", RuleCall.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedRuleCall.predicated);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedRuleCall.firstSetPredicated);
                }
            },
        ]);
        this.consumeLeaf(3, ID, this.grammarAccess.PredicatedRuleCall.rule);
        this.option(1, () => {
            this.consumeLeaf(4, LessThanKeyword, this.grammarAccess.PredicatedRuleCall.LessThanKeyword);
            this.subruleLeaf(1, this.NamedArgument, this.grammarAccess.PredicatedRuleCall.arguments);
            this.many(1, () => {
                this.consumeLeaf(5, CommaKeyword, this.grammarAccess.PredicatedRuleCall.CommaKeyword);
                this.subruleLeaf(2, this.NamedArgument, this.grammarAccess.PredicatedRuleCall.arguments);
            });
            this.consumeLeaf(6, MoreThanKeyword, this.grammarAccess.PredicatedRuleCall.MoreThanKeyword);
        });
        return this.construct<RuleCall>();
    })

    private Assignment = this.DEFINE_RULE("Assignment", AbstractElement.kind, () => {
        this.executeAction(Assignment.kind, this.grammarAccess.Assignment.AssignmentAction);
        this.option(1, () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.Assignment.predicated);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.Assignment.firstSetPredicated);
                    }
                },
            ]);
        });
        this.consumeLeaf(3, ID, this.grammarAccess.Assignment.feature);
        this.or(2, [
            {
                ALT: () => {
                    this.consumeLeaf(4, PlusEqualsKeyword, this.grammarAccess.Assignment.operator);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(5, EqualsKeyword, this.grammarAccess.Assignment.operator);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(6, QuestionMarkEqualsKeyword, this.grammarAccess.Assignment.operator);
                }
            },
        ]);
        this.subruleLeaf(1, this.AssignableTerminal, this.grammarAccess.Assignment.terminal);
        return this.construct<AbstractElement>();
    })

    private AssignableTerminal = this.DEFINE_RULE("AssignableTerminal", AbstractElement.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.Keyword, this.grammarAccess.AssignableTerminal.KeywordRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.RuleCall, this.grammarAccess.AssignableTerminal.RuleCallRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(3, this.ParenthesizedAssignableElement, this.grammarAccess.AssignableTerminal.ParenthesizedAssignableElementRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(4, this.CrossReference, this.grammarAccess.AssignableTerminal.CrossReferenceRuleCall);
                }
            },
        ]);
        return this.construct<AbstractElement>();
    })

    private ParenthesizedAssignableElement = this.DEFINE_RULE("ParenthesizedAssignableElement", AbstractElement.kind, () => {
        this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedAssignableElement.ParenthesisOpenKeyword);
        this.unassignedSubrule(1, this.AssignableAlternatives, this.grammarAccess.ParenthesizedAssignableElement.AssignableAlternativesRuleCall);
        this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedAssignableElement.ParenthesisCloseKeyword);
        return this.construct<AbstractElement>();
    })

    private AssignableAlternatives = this.DEFINE_RULE("AssignableAlternatives", AbstractElement.kind, () => {
        this.unassignedSubrule(1, this.AssignableTerminal, this.grammarAccess.AssignableAlternatives.AssignableTerminalRuleCall);
        this.option(1, () => {
            this.executeAction(Alternatives.kind, this.grammarAccess.AssignableAlternatives.AlternativeselementsAction);
            this.many(1, () => {
                this.consumeLeaf(1, PipeKeyword, this.grammarAccess.AssignableAlternatives.PipeKeyword);
                this.subruleLeaf(2, this.AssignableTerminal, this.grammarAccess.AssignableAlternatives.elements);
            });
        });
        return this.construct<AbstractElement>();
    })

    private CrossReference = this.DEFINE_RULE("CrossReference", AbstractElement.kind, () => {
        this.executeAction(CrossReference.kind, this.grammarAccess.CrossReference.CrossReferenceAction);
        this.consumeLeaf(1, BracketOpenKeyword, this.grammarAccess.CrossReference.BracketOpenKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.CrossReference.type);
        this.option(1, () => {
            this.consumeLeaf(3, PipeKeyword, this.grammarAccess.CrossReference.PipeKeyword);
            this.subruleLeaf(1, this.CrossReferenceableTerminal, this.grammarAccess.CrossReference.terminal);
        });
        this.consumeLeaf(4, BracketCloseKeyword, this.grammarAccess.CrossReference.BracketCloseKeyword);
        return this.construct<AbstractElement>();
    })

    private CrossReferenceableTerminal = this.DEFINE_RULE("CrossReferenceableTerminal", AbstractElement.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.Keyword, this.grammarAccess.CrossReferenceableTerminal.KeywordRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.RuleCall, this.grammarAccess.CrossReferenceableTerminal.RuleCallRuleCall);
                }
            },
        ]);
        return this.construct<AbstractElement>();
    })

    private ParenthesizedElement = this.DEFINE_RULE("ParenthesizedElement", AbstractElement.kind, () => {
        this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedElement.ParenthesisOpenKeyword);
        this.unassignedSubrule(1, this.Alternatives, this.grammarAccess.ParenthesizedElement.AlternativesRuleCall);
        this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedElement.ParenthesisCloseKeyword);
        return this.construct<AbstractElement>();
    })

    private PredicatedGroup = this.DEFINE_RULE("PredicatedGroup", Group.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedGroup.predicated);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedGroup.firstSetPredicated);
                }
            },
        ]);
        this.consumeLeaf(3, ParenthesisOpenKeyword, this.grammarAccess.PredicatedGroup.ParenthesisOpenKeyword);
        this.subruleLeaf(1, this.Alternatives, this.grammarAccess.PredicatedGroup.elements);
        this.consumeLeaf(4, ParenthesisCloseKeyword, this.grammarAccess.PredicatedGroup.ParenthesisCloseKeyword);
        return this.construct<Group>();
    })

    private TerminalRule = this.DEFINE_RULE("TerminalRule", TerminalRule.kind, () => {
        this.consumeLeaf(1, TerminalKeyword, this.grammarAccess.TerminalRule.TerminalKeyword);
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(2, FragmentKeyword, this.grammarAccess.TerminalRule.fragment);
                    this.consumeLeaf(3, ID, this.grammarAccess.TerminalRule.name);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(4, ID, this.grammarAccess.TerminalRule.name);
                    this.option(1, () => {
                        this.consumeLeaf(5, ReturnsKeyword, this.grammarAccess.TerminalRule.ReturnsKeyword);
                        this.consumeLeaf(6, ID, this.grammarAccess.TerminalRule.type);
                    });
                }
            },
        ]);
        this.consumeLeaf(7, ColonKeyword, this.grammarAccess.TerminalRule.ColonKeyword);
        this.consumeLeaf(8, RegexLiteral, this.grammarAccess.TerminalRule.regex);
        this.consumeLeaf(9, SemicolonKeyword, this.grammarAccess.TerminalRule.SemicolonKeyword);
        return this.construct<TerminalRule>();
    })

    private TerminalAlternatives = this.DEFINE_RULE("TerminalAlternatives", TerminalAlternatives.kind, () => {
        this.unassignedSubrule(1, this.TerminalGroup, this.grammarAccess.TerminalAlternatives.TerminalGroupRuleCall);
        this.many(1, () => {
            this.executeAction(TerminalAlternatives.kind, this.grammarAccess.TerminalAlternatives.TerminalAlternativeselementsAction);
            this.consumeLeaf(1, PipeKeyword, this.grammarAccess.TerminalAlternatives.PipeKeyword);
            this.subruleLeaf(2, this.TerminalGroup, this.grammarAccess.TerminalAlternatives.elements);
        });
        return this.construct<TerminalAlternatives>();
    })

    private TerminalGroup = this.DEFINE_RULE("TerminalGroup", TerminalGroup.kind, () => {
        this.subruleLeaf(1, this.TerminalToken, this.grammarAccess.TerminalGroup.elements);
        return this.construct<TerminalGroup>();
    })

    private TerminalToken = this.DEFINE_RULE("TerminalToken", TerminalToken.kind, () => {
        this.unassignedSubrule(1, this.TerminalTokenElement, this.grammarAccess.TerminalToken.TerminalTokenElementRuleCall);
        this.option(1, () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.consumeLeaf(1, QuestionMarkKeyword, this.grammarAccess.TerminalToken.cardinality);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(2, AsteriskKeyword, this.grammarAccess.TerminalToken.cardinality);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(3, PlusKeyword, this.grammarAccess.TerminalToken.cardinality);
                    }
                },
            ]);
        });
        return this.construct<TerminalToken>();
    })

    private TerminalTokenElement = this.DEFINE_RULE("TerminalTokenElement", TerminalTokenElement.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.CharacterRange, this.grammarAccess.TerminalTokenElement.CharacterRangeRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.TerminalRuleCall, this.grammarAccess.TerminalTokenElement.TerminalRuleCallRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(3, this.ParenthesizedTerminalElement, this.grammarAccess.TerminalTokenElement.ParenthesizedTerminalElementRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(4, this.AbstractNegatedToken, this.grammarAccess.TerminalTokenElement.AbstractNegatedTokenRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(5, this.Wildcard, this.grammarAccess.TerminalTokenElement.WildcardRuleCall);
                }
            },
        ]);
        return this.construct<TerminalTokenElement>();
    })

    private ParenthesizedTerminalElement = this.DEFINE_RULE("ParenthesizedTerminalElement", ParenthesizedTerminalElement.kind, () => {
        this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedTerminalElement.ParenthesisOpenKeyword);
        this.unassignedSubrule(1, this.TerminalAlternatives, this.grammarAccess.ParenthesizedTerminalElement.TerminalAlternativesRuleCall);
        this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedTerminalElement.ParenthesisCloseKeyword);
        return this.construct<ParenthesizedTerminalElement>();
    })

    private AbstractNegatedToken = this.DEFINE_RULE("AbstractNegatedToken", AbstractNegatedToken.kind, () => {
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.NegatedToken, this.grammarAccess.AbstractNegatedToken.NegatedTokenRuleCall);
                }
            },
            {
                ALT: () => {
                    this.unassignedSubrule(2, this.UntilToken, this.grammarAccess.AbstractNegatedToken.UntilTokenRuleCall);
                }
            },
        ]);
        return this.construct<AbstractNegatedToken>();
    })

    private NegatedToken = this.DEFINE_RULE("NegatedToken", NegatedToken.kind, () => {
        this.consumeLeaf(1, ExclamationMarkKeyword, this.grammarAccess.NegatedToken.ExclamationMarkKeyword);
        this.subruleLeaf(1, this.TerminalTokenElement, this.grammarAccess.NegatedToken.terminal);
        return this.construct<NegatedToken>();
    })

    private UntilToken = this.DEFINE_RULE("UntilToken", UntilToken.kind, () => {
        this.consumeLeaf(1, DashMoreThanKeyword, this.grammarAccess.UntilToken.DashMoreThanKeyword);
        this.subruleLeaf(1, this.TerminalTokenElement, this.grammarAccess.UntilToken.terminal);
        return this.construct<UntilToken>();
    })

    private Wildcard = this.DEFINE_RULE("Wildcard", Wildcard.kind, () => {
        this.executeAction(Wildcard.kind, this.grammarAccess.Wildcard.WildcardAction);
        this.consumeLeaf(1, DotKeyword, this.grammarAccess.Wildcard.DotKeyword);
        return this.construct<Wildcard>();
    })

    private CharacterRange = this.DEFINE_RULE("CharacterRange", CharacterRange.kind, () => {
        this.subruleLeaf(1, this.Keyword, this.grammarAccess.CharacterRange.left);
        this.option(1, () => {
            this.consumeLeaf(1, DotDotKeyword, this.grammarAccess.CharacterRange.DotDotKeyword);
            this.subruleLeaf(2, this.Keyword, this.grammarAccess.CharacterRange.right);
        });
        return this.construct<CharacterRange>();
    })

    private EnumRule = this.DEFINE_RULE("EnumRule", EnumRule.kind, () => {
        this.consumeLeaf(1, EnumKeyword, this.grammarAccess.EnumRule.EnumKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.EnumRule.name);
        this.option(1, () => {
            this.consumeLeaf(3, ReturnsKeyword, this.grammarAccess.EnumRule.ReturnsKeyword);
            this.consumeLeaf(4, ID, this.grammarAccess.EnumRule.type);
        });
        this.consumeLeaf(5, ColonKeyword, this.grammarAccess.EnumRule.ColonKeyword);
        this.subruleLeaf(1, this.EnumLiterals, this.grammarAccess.EnumRule.alternatives);
        this.consumeLeaf(6, SemicolonKeyword, this.grammarAccess.EnumRule.SemicolonKeyword);
        return this.construct<EnumRule>();
    })

    private EnumLiterals = this.DEFINE_RULE("EnumLiterals", EnumLiterals.kind, () => {
        this.unassignedSubrule(1, this.EnumLiteralDeclaration, this.grammarAccess.EnumLiterals.EnumLiteralDeclarationRuleCall);
        this.many(1, () => {
            this.executeAction(EnumLiterals.kind, this.grammarAccess.EnumLiterals.EnumLiteralselementsAction);
            this.consumeLeaf(1, PipeKeyword, this.grammarAccess.EnumLiterals.PipeKeyword);
            this.subruleLeaf(2, this.EnumLiteralDeclaration, this.grammarAccess.EnumLiterals.elements);
        });
        return this.construct<EnumLiterals>();
    })

    private EnumLiteralDeclaration = this.DEFINE_RULE("EnumLiteralDeclaration", EnumLiteralDeclaration.kind, () => {
        this.consumeLeaf(1, ID, this.grammarAccess.EnumLiteralDeclaration.enumLiteral);
        this.option(1, () => {
            this.consumeLeaf(2, EqualsKeyword, this.grammarAccess.EnumLiteralDeclaration.EqualsKeyword);
            this.subruleLeaf(1, this.Keyword, this.grammarAccess.EnumLiteralDeclaration.literal);
        });
        return this.construct<EnumLiteralDeclaration>();
    })

}

let parser: Parser | undefined;

export function parse(grammarAccess: LangiumGrammarAccess, text: string) {
    if (!parser) {
        parser = new Parser(grammarAccess);
    }
    const lexResult = lexer.tokenize(text);
    parser.input = lexResult.tokens;
    const ast = parser.parse(text);
    return {
        ast,
        lexErrors: lexResult.errors,
        parseErrors: parser.errors
    }
}
