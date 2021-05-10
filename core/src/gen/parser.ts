/* eslint-disable */
// @ts-nocheck
import { createToken, Lexer } from 'chevrotain';
import { Number, String, LangiumParser } from '../index';
import { LangiumGrammarAccess } from './grammar-access';
import { AbstractElement, AbstractMetamodelDeclaration, AbstractNegatedToken, AbstractRule, Annotation, Condition, EnumLiteralDeclaration, EnumLiterals, Grammar, NamedArgument, Parameter, TerminalGroup, TerminalToken, TerminalTokenElement, Action, Alternatives, Assignment, CrossReference, Group, Keyword, RuleCall, UnorderedGroup, GeneratedMetamodel, ReferencedMetamodel, NegatedToken, UntilToken, EnumRule, ParserRule, TerminalRule, Conjunction, Disjunction, LiteralCondition, Negation, ParameterReference, CharacterRange, TerminalAlternatives, TerminalRuleCall, Wildcard, } from './ast';

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

export class Parser extends LangiumParser {
    grammarAccess: LangiumGrammarAccess;
    constructor(grammarAccess: LangiumGrammarAccess) {
        super(tokens);
        this.grammarAccess = grammarAccess;
        this.performSelfAnalysis();
    }

    Grammar = this.MAIN_RULE("Grammar", Grammar.type, () => {
        this.initialize(this.grammarAccess.Grammar);
        this.consumeLeaf(1, GrammarKeyword, this.grammarAccess.Grammar.GrammarKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.Grammar.nameIDRuleCall);
        this.option(1, () => {
            this.consumeLeaf(3, WithKeyword, this.grammarAccess.Grammar.WithKeyword);
            this.consumeLeaf(4, ID, this.grammarAccess.Grammar.usedGrammarsGrammarCrossReference);
            this.many(1, () => {
                this.consumeLeaf(5, CommaKeyword, this.grammarAccess.Grammar.CommaKeyword);
                this.consumeLeaf(6, ID, this.grammarAccess.Grammar.usedGrammarsGrammarCrossReference);
            });
        });
        this.option(3, () => {
            this.consumeLeaf(7, HiddenKeyword, this.grammarAccess.Grammar.HiddenKeyword);
            this.consumeLeaf(8, ParenthesisOpenKeyword, this.grammarAccess.Grammar.ParenthesisOpenKeyword);
            this.option(2, () => {
                this.consumeLeaf(9, ID, this.grammarAccess.Grammar.hiddenTokensAbstractRuleCrossReference);
                this.many(2, () => {
                    this.consumeLeaf(10, CommaKeyword, this.grammarAccess.Grammar.CommaKeyword);
                    this.consumeLeaf(11, ID, this.grammarAccess.Grammar.hiddenTokensAbstractRuleCrossReference);
                });
            });
            this.consumeLeaf(12, ParenthesisCloseKeyword, this.grammarAccess.Grammar.ParenthesisCloseKeyword);
        });
        this.many(3, () => {
            this.subruleLeaf(1, this.AbstractMetamodelDeclaration, this.grammarAccess.Grammar.metamodelDeclarationsAbstractMetamodelDeclarationRuleCall);
        });
        this.many(4, () => {
            this.subruleLeaf(2, this.AbstractRule, this.grammarAccess.Grammar.rulesAbstractRuleRuleCall);
        });
        return this.construct();
    });

    AbstractRule = this.DEFINE_RULE("AbstractRule", AbstractRule.type, () => {
        this.initialize(this.grammarAccess.AbstractRule);
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
        return this.construct();
    });

    AbstractMetamodelDeclaration = this.DEFINE_RULE("AbstractMetamodelDeclaration", AbstractMetamodelDeclaration.type, () => {
        this.initialize(this.grammarAccess.AbstractMetamodelDeclaration);
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
        return this.construct();
    });

    GeneratedMetamodel = this.DEFINE_RULE("GeneratedMetamodel", GeneratedMetamodel.type, () => {
        this.initialize(this.grammarAccess.GeneratedMetamodel);
        this.consumeLeaf(1, GenerateKeyword, this.grammarAccess.GeneratedMetamodel.GenerateKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.GeneratedMetamodel.nameIDRuleCall);
        this.consumeLeaf(3, string, this.grammarAccess.GeneratedMetamodel.ePackagestringRuleCall);
        this.option(1, () => {
            this.consumeLeaf(4, AsKeyword, this.grammarAccess.GeneratedMetamodel.AsKeyword);
            this.consumeLeaf(5, ID, this.grammarAccess.GeneratedMetamodel.aliasIDRuleCall);
        });
        return this.construct();
    });

    ReferencedMetamodel = this.DEFINE_RULE("ReferencedMetamodel", ReferencedMetamodel.type, () => {
        this.initialize(this.grammarAccess.ReferencedMetamodel);
        this.consumeLeaf(1, ImportKeyword, this.grammarAccess.ReferencedMetamodel.ImportKeyword);
        this.consumeLeaf(2, string, this.grammarAccess.ReferencedMetamodel.ePackagestringRuleCall);
        this.option(1, () => {
            this.consumeLeaf(3, AsKeyword, this.grammarAccess.ReferencedMetamodel.AsKeyword);
            this.consumeLeaf(4, ID, this.grammarAccess.ReferencedMetamodel.aliasIDRuleCall);
        });
        return this.construct();
    });

    Annotation = this.DEFINE_RULE("Annotation", Annotation.type, () => {
        this.initialize(this.grammarAccess.Annotation);
        this.consumeLeaf(1, AtKeyword, this.grammarAccess.Annotation.AtKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.Annotation.nameIDRuleCall);
        return this.construct();
    });

    ParserRule = this.DEFINE_RULE("ParserRule", ParserRule.type, () => {
        this.initialize(this.grammarAccess.ParserRule);
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, FragmentKeyword, this.grammarAccess.ParserRule.FragmentKeyword);
                    this.unassignedSubrule(1, this.RuleNameAndParams, this.grammarAccess.ParserRule.RuleNameAndParamsRuleCall);
                    this.or(2, [
                        {
                            ALT: () => {
                                this.consumeLeaf(2, AsteriskKeyword, this.grammarAccess.ParserRule.AsteriskKeyword);
                            }
                        },
                        {
                            ALT: () => {
                                this.option(1, () => {
                                    this.consumeLeaf(3, ReturnsKeyword, this.grammarAccess.ParserRule.ReturnsKeyword);
                                    this.consumeLeaf(4, ID, this.grammarAccess.ParserRule.typeIDRuleCall);
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
                        this.consumeLeaf(6, ID, this.grammarAccess.ParserRule.typeIDRuleCall);
                    });
                }
            },
        ]);
        this.option(4, () => {
            this.consumeLeaf(7, HiddenKeyword, this.grammarAccess.ParserRule.HiddenKeyword);
            this.consumeLeaf(8, ParenthesisOpenKeyword, this.grammarAccess.ParserRule.ParenthesisOpenKeyword);
            this.option(3, () => {
                this.consumeLeaf(9, ID, this.grammarAccess.ParserRule.hiddenTokensAbstractRuleCrossReference);
                this.many(1, () => {
                    this.consumeLeaf(10, CommaKeyword, this.grammarAccess.ParserRule.CommaKeyword);
                    this.consumeLeaf(11, ID, this.grammarAccess.ParserRule.hiddenTokensAbstractRuleCrossReference);
                });
            });
            this.consumeLeaf(12, ParenthesisCloseKeyword, this.grammarAccess.ParserRule.ParenthesisCloseKeyword);
        });
        this.consumeLeaf(13, ColonKeyword, this.grammarAccess.ParserRule.ColonKeyword);
        this.subruleLeaf(3, this.Alternatives, this.grammarAccess.ParserRule.alternativesAlternativesRuleCall);
        this.consumeLeaf(14, SemicolonKeyword, this.grammarAccess.ParserRule.SemicolonKeyword);
        return this.construct();
    });

    RuleNameAndParams = this.DEFINE_RULE("RuleNameAndParams", undefined, () => {
        this.initialize(this.grammarAccess.RuleNameAndParams);
        this.consumeLeaf(1, ID, this.grammarAccess.RuleNameAndParams.nameIDRuleCall);
        this.option(2, () => {
            this.consumeLeaf(2, LessThanKeyword, this.grammarAccess.RuleNameAndParams.LessThanKeyword);
            this.option(1, () => {
                this.subruleLeaf(1, this.Parameter, this.grammarAccess.RuleNameAndParams.parametersParameterRuleCall);
                this.many(1, () => {
                    this.consumeLeaf(3, CommaKeyword, this.grammarAccess.RuleNameAndParams.CommaKeyword);
                    this.subruleLeaf(2, this.Parameter, this.grammarAccess.RuleNameAndParams.parametersParameterRuleCall);
                });
            });
            this.consumeLeaf(4, MoreThanKeyword, this.grammarAccess.RuleNameAndParams.MoreThanKeyword);
        });
        return this.construct();
    });

    Parameter = this.DEFINE_RULE("Parameter", Parameter.type, () => {
        this.initialize(this.grammarAccess.Parameter);
        this.consumeLeaf(1, ID, this.grammarAccess.Parameter.nameIDRuleCall);
        return this.construct();
    });

    Alternatives = this.DEFINE_RULE("Alternatives", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.Alternatives);
        this.unassignedSubrule(1, this.UnorderedGroup, this.grammarAccess.Alternatives.UnorderedGroupRuleCall);
        this.many(1, () => {
            this.executeAction(Alternatives.type, this.grammarAccess.Alternatives.AlternativeselementsAction);
            this.consumeLeaf(1, PipeKeyword, this.grammarAccess.Alternatives.PipeKeyword);
            this.subruleLeaf(2, this.UnorderedGroup, this.grammarAccess.Alternatives.elementsUnorderedGroupRuleCall);
        });
        return this.construct();
    });

    UnorderedGroup = this.DEFINE_RULE("UnorderedGroup", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.UnorderedGroup);
        this.unassignedSubrule(1, this.Group, this.grammarAccess.UnorderedGroup.GroupRuleCall);
        this.many(1, () => {
            this.executeAction(UnorderedGroup.type, this.grammarAccess.UnorderedGroup.UnorderedGroupelementsAction);
            this.consumeLeaf(1, AmpersandKeyword, this.grammarAccess.UnorderedGroup.AmpersandKeyword);
            this.subruleLeaf(2, this.Group, this.grammarAccess.UnorderedGroup.elementsGroupRuleCall);
        });
        return this.construct();
    });

    Group = this.DEFINE_RULE("Group", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.Group);
        this.unassignedSubrule(1, this.AbstractToken, this.grammarAccess.Group.AbstractTokenRuleCall);
        this.many(1, () => {
            this.executeAction(Group.type, this.grammarAccess.Group.GroupelementsAction);
            this.subruleLeaf(2, this.AbstractToken, this.grammarAccess.Group.elementsAbstractTokenRuleCall);
        });
        return this.construct();
    });

    AbstractToken = this.DEFINE_RULE("AbstractToken", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.AbstractToken);
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
        return this.construct();
    });

    AbstractTokenWithCardinality = this.DEFINE_RULE("AbstractTokenWithCardinality", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.AbstractTokenWithCardinality);
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
                        this.consumeLeaf(1, QuestionMarkKeyword, this.grammarAccess.AbstractTokenWithCardinality.QuestionMarkKeyword);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(2, AsteriskKeyword, this.grammarAccess.AbstractTokenWithCardinality.AsteriskKeyword);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(3, PlusKeyword, this.grammarAccess.AbstractTokenWithCardinality.PlusKeyword);
                    }
                },
            ]);
        });
        return this.construct();
    });

    Action = this.DEFINE_RULE("Action", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.Action);
        this.executeAction(Action.type, this.grammarAccess.Action.ActionAction);
        this.consumeLeaf(1, CurlyOpenKeyword, this.grammarAccess.Action.CurlyOpenKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.Action.typeIDRuleCall);
        this.option(1, () => {
            this.consumeLeaf(3, DotKeyword, this.grammarAccess.Action.DotKeyword);
            this.consumeLeaf(4, ID, this.grammarAccess.Action.featureIDRuleCall);
            this.or(1, [
                {
                    ALT: () => {
                        this.consumeLeaf(5, EqualsKeyword, this.grammarAccess.Action.EqualsKeyword);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(6, PlusEqualsKeyword, this.grammarAccess.Action.PlusEqualsKeyword);
                    }
                },
            ]);
            this.consumeLeaf(7, CurrentKeyword, this.grammarAccess.Action.CurrentKeyword);
        });
        this.consumeLeaf(8, CurlyCloseKeyword, this.grammarAccess.Action.CurlyCloseKeyword);
        return this.construct();
    });

    AbstractTerminal = this.DEFINE_RULE("AbstractTerminal", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.AbstractTerminal);
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
        return this.construct();
    });

    Keyword = this.DEFINE_RULE("Keyword", Keyword.type, () => {
        this.initialize(this.grammarAccess.Keyword);
        this.consumeLeaf(1, string, this.grammarAccess.Keyword.valuestringRuleCall);
        return this.construct();
    });

    RuleCall = this.DEFINE_RULE("RuleCall", RuleCall.type, () => {
        this.initialize(this.grammarAccess.RuleCall);
        this.consumeLeaf(1, ID, this.grammarAccess.RuleCall.ruleAbstractRuleCrossReference);
        this.option(1, () => {
            this.consumeLeaf(2, LessThanKeyword, this.grammarAccess.RuleCall.LessThanKeyword);
            this.subruleLeaf(1, this.NamedArgument, this.grammarAccess.RuleCall.argumentsNamedArgumentRuleCall);
            this.many(1, () => {
                this.consumeLeaf(3, CommaKeyword, this.grammarAccess.RuleCall.CommaKeyword);
                this.subruleLeaf(2, this.NamedArgument, this.grammarAccess.RuleCall.argumentsNamedArgumentRuleCall);
            });
            this.consumeLeaf(4, MoreThanKeyword, this.grammarAccess.RuleCall.MoreThanKeyword);
        });
        return this.construct();
    });

    NamedArgument = this.DEFINE_RULE("NamedArgument", NamedArgument.type, () => {
        this.initialize(this.grammarAccess.NamedArgument);
        this.option(1, () => {
            this.consumeLeaf(1, ID, this.grammarAccess.NamedArgument.parameterParameterCrossReference);
            this.consumeLeaf(2, EqualsKeyword, this.grammarAccess.NamedArgument.EqualsKeyword);
        });
        this.subruleLeaf(1, this.Disjunction, this.grammarAccess.NamedArgument.valueDisjunctionRuleCall);
        return this.construct();
    });

    LiteralCondition = this.DEFINE_RULE("LiteralCondition", LiteralCondition.type, () => {
        this.initialize(this.grammarAccess.LiteralCondition);
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, TrueKeyword, this.grammarAccess.LiteralCondition.TrueKeyword);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(2, FalseKeyword, this.grammarAccess.LiteralCondition.FalseKeyword);
                }
            },
        ]);
        return this.construct();
    });

    Disjunction = this.DEFINE_RULE("Disjunction", Condition.type, () => {
        this.initialize(this.grammarAccess.Disjunction);
        this.unassignedSubrule(1, this.Conjunction, this.grammarAccess.Disjunction.ConjunctionRuleCall);
        this.option(1, () => {
            this.executeAction(Disjunction.type, this.grammarAccess.Disjunction.DisjunctionleftAction);
            this.consumeLeaf(1, PipeKeyword, this.grammarAccess.Disjunction.PipeKeyword);
            this.subruleLeaf(2, this.Conjunction, this.grammarAccess.Disjunction.rightConjunctionRuleCall);
        });
        return this.construct();
    });

    Conjunction = this.DEFINE_RULE("Conjunction", Condition.type, () => {
        this.initialize(this.grammarAccess.Conjunction);
        this.unassignedSubrule(1, this.Negation, this.grammarAccess.Conjunction.NegationRuleCall);
        this.option(1, () => {
            this.executeAction(Conjunction.type, this.grammarAccess.Conjunction.ConjunctionleftAction);
            this.consumeLeaf(1, AmpersandKeyword, this.grammarAccess.Conjunction.AmpersandKeyword);
            this.subruleLeaf(2, this.Negation, this.grammarAccess.Conjunction.rightNegationRuleCall);
        });
        return this.construct();
    });

    Negation = this.DEFINE_RULE("Negation", Condition.type, () => {
        this.initialize(this.grammarAccess.Negation);
        this.or(1, [
            {
                ALT: () => {
                    this.unassignedSubrule(1, this.Atom, this.grammarAccess.Negation.AtomRuleCall);
                }
            },
            {
                ALT: () => {
                    this.executeAction(Negation.type, this.grammarAccess.Negation.NegationAction);
                    this.consumeLeaf(1, ExclamationMarkKeyword, this.grammarAccess.Negation.ExclamationMarkKeyword);
                    this.subruleLeaf(2, this.Negation, this.grammarAccess.Negation.valueNegationRuleCall);
                }
            },
        ]);
        return this.construct();
    });

    Atom = this.DEFINE_RULE("Atom", Condition.type, () => {
        this.initialize(this.grammarAccess.Atom);
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
        return this.construct();
    });

    ParenthesizedCondition = this.DEFINE_RULE("ParenthesizedCondition", Condition.type, () => {
        this.initialize(this.grammarAccess.ParenthesizedCondition);
        this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedCondition.ParenthesisOpenKeyword);
        this.unassignedSubrule(1, this.Disjunction, this.grammarAccess.ParenthesizedCondition.DisjunctionRuleCall);
        this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedCondition.ParenthesisCloseKeyword);
        return this.construct();
    });

    ParameterReference = this.DEFINE_RULE("ParameterReference", ParameterReference.type, () => {
        this.initialize(this.grammarAccess.ParameterReference);
        this.consumeLeaf(1, ID, this.grammarAccess.ParameterReference.parameterParameterCrossReference);
        return this.construct();
    });

    TerminalRuleCall = this.DEFINE_RULE("TerminalRuleCall", TerminalRuleCall.type, () => {
        this.initialize(this.grammarAccess.TerminalRuleCall);
        this.consumeLeaf(1, ID, this.grammarAccess.TerminalRuleCall.ruleAbstractRuleCrossReference);
        return this.construct();
    });

    PredicatedKeyword = this.DEFINE_RULE("PredicatedKeyword", Keyword.type, () => {
        this.initialize(this.grammarAccess.PredicatedKeyword);
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedKeyword.EqualsMoreThanKeyword);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedKeyword.DashMoreThanKeyword);
                }
            },
        ]);
        this.consumeLeaf(3, string, this.grammarAccess.PredicatedKeyword.valuestringRuleCall);
        return this.construct();
    });

    PredicatedRuleCall = this.DEFINE_RULE("PredicatedRuleCall", RuleCall.type, () => {
        this.initialize(this.grammarAccess.PredicatedRuleCall);
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedRuleCall.EqualsMoreThanKeyword);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedRuleCall.DashMoreThanKeyword);
                }
            },
        ]);
        this.consumeLeaf(3, ID, this.grammarAccess.PredicatedRuleCall.ruleAbstractRuleCrossReference);
        this.option(1, () => {
            this.consumeLeaf(4, LessThanKeyword, this.grammarAccess.PredicatedRuleCall.LessThanKeyword);
            this.subruleLeaf(1, this.NamedArgument, this.grammarAccess.PredicatedRuleCall.argumentsNamedArgumentRuleCall);
            this.many(1, () => {
                this.consumeLeaf(5, CommaKeyword, this.grammarAccess.PredicatedRuleCall.CommaKeyword);
                this.subruleLeaf(2, this.NamedArgument, this.grammarAccess.PredicatedRuleCall.argumentsNamedArgumentRuleCall);
            });
            this.consumeLeaf(6, MoreThanKeyword, this.grammarAccess.PredicatedRuleCall.MoreThanKeyword);
        });
        return this.construct();
    });

    Assignment = this.DEFINE_RULE("Assignment", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.Assignment);
        this.executeAction(Assignment.type, this.grammarAccess.Assignment.AssignmentAction);
        this.option(1, () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.Assignment.EqualsMoreThanKeyword);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.Assignment.DashMoreThanKeyword);
                    }
                },
            ]);
        });
        this.consumeLeaf(3, ID, this.grammarAccess.Assignment.featureIDRuleCall);
        this.or(2, [
            {
                ALT: () => {
                    this.consumeLeaf(4, PlusEqualsKeyword, this.grammarAccess.Assignment.PlusEqualsKeyword);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(5, EqualsKeyword, this.grammarAccess.Assignment.EqualsKeyword);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(6, QuestionMarkEqualsKeyword, this.grammarAccess.Assignment.QuestionMarkEqualsKeyword);
                }
            },
        ]);
        this.subruleLeaf(1, this.AssignableTerminal, this.grammarAccess.Assignment.terminalAssignableTerminalRuleCall);
        return this.construct();
    });

    AssignableTerminal = this.DEFINE_RULE("AssignableTerminal", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.AssignableTerminal);
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
        return this.construct();
    });

    ParenthesizedAssignableElement = this.DEFINE_RULE("ParenthesizedAssignableElement", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.ParenthesizedAssignableElement);
        this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedAssignableElement.ParenthesisOpenKeyword);
        this.unassignedSubrule(1, this.AssignableAlternatives, this.grammarAccess.ParenthesizedAssignableElement.AssignableAlternativesRuleCall);
        this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedAssignableElement.ParenthesisCloseKeyword);
        return this.construct();
    });

    AssignableAlternatives = this.DEFINE_RULE("AssignableAlternatives", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.AssignableAlternatives);
        this.unassignedSubrule(1, this.AssignableTerminal, this.grammarAccess.AssignableAlternatives.AssignableTerminalRuleCall);
        this.option(1, () => {
            this.executeAction(Alternatives.type, this.grammarAccess.AssignableAlternatives.AlternativeselementsAction);
            this.many(1, () => {
                this.consumeLeaf(1, PipeKeyword, this.grammarAccess.AssignableAlternatives.PipeKeyword);
                this.subruleLeaf(2, this.AssignableTerminal, this.grammarAccess.AssignableAlternatives.elementsAssignableTerminalRuleCall);
            });
        });
        return this.construct();
    });

    CrossReference = this.DEFINE_RULE("CrossReference", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.CrossReference);
        this.executeAction(CrossReference.type, this.grammarAccess.CrossReference.CrossReferenceAction);
        this.consumeLeaf(1, BracketOpenKeyword, this.grammarAccess.CrossReference.BracketOpenKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.CrossReference.typeParserRuleCrossReference);
        this.option(1, () => {
            this.consumeLeaf(3, PipeKeyword, this.grammarAccess.CrossReference.PipeKeyword);
            this.subruleLeaf(1, this.CrossReferenceableTerminal, this.grammarAccess.CrossReference.terminalCrossReferenceableTerminalRuleCall);
        });
        this.consumeLeaf(4, BracketCloseKeyword, this.grammarAccess.CrossReference.BracketCloseKeyword);
        return this.construct();
    });

    CrossReferenceableTerminal = this.DEFINE_RULE("CrossReferenceableTerminal", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.CrossReferenceableTerminal);
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
        return this.construct();
    });

    ParenthesizedElement = this.DEFINE_RULE("ParenthesizedElement", AbstractElement.type, () => {
        this.initialize(this.grammarAccess.ParenthesizedElement);
        this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedElement.ParenthesisOpenKeyword);
        this.unassignedSubrule(1, this.Alternatives, this.grammarAccess.ParenthesizedElement.AlternativesRuleCall);
        this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedElement.ParenthesisCloseKeyword);
        return this.construct();
    });

    PredicatedGroup = this.DEFINE_RULE("PredicatedGroup", Group.type, () => {
        this.initialize(this.grammarAccess.PredicatedGroup);
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(1, EqualsMoreThanKeyword, this.grammarAccess.PredicatedGroup.EqualsMoreThanKeyword);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(2, DashMoreThanKeyword, this.grammarAccess.PredicatedGroup.DashMoreThanKeyword);
                }
            },
        ]);
        this.consumeLeaf(3, ParenthesisOpenKeyword, this.grammarAccess.PredicatedGroup.ParenthesisOpenKeyword);
        this.subruleLeaf(1, this.Alternatives, this.grammarAccess.PredicatedGroup.elementsAlternativesRuleCall);
        this.consumeLeaf(4, ParenthesisCloseKeyword, this.grammarAccess.PredicatedGroup.ParenthesisCloseKeyword);
        return this.construct();
    });

    TerminalRule = this.DEFINE_RULE("TerminalRule", TerminalRule.type, () => {
        this.initialize(this.grammarAccess.TerminalRule);
        this.consumeLeaf(1, TerminalKeyword, this.grammarAccess.TerminalRule.TerminalKeyword);
        this.or(1, [
            {
                ALT: () => {
                    this.consumeLeaf(2, FragmentKeyword, this.grammarAccess.TerminalRule.FragmentKeyword);
                    this.consumeLeaf(3, ID, this.grammarAccess.TerminalRule.nameIDRuleCall);
                }
            },
            {
                ALT: () => {
                    this.consumeLeaf(4, ID, this.grammarAccess.TerminalRule.nameIDRuleCall);
                    this.option(1, () => {
                        this.consumeLeaf(5, ReturnsKeyword, this.grammarAccess.TerminalRule.ReturnsKeyword);
                        this.consumeLeaf(6, ID, this.grammarAccess.TerminalRule.typeIDRuleCall);
                    });
                }
            },
        ]);
        this.consumeLeaf(7, ColonKeyword, this.grammarAccess.TerminalRule.ColonKeyword);
        this.consumeLeaf(8, RegexLiteral, this.grammarAccess.TerminalRule.regexRegexLiteralRuleCall);
        this.consumeLeaf(9, SemicolonKeyword, this.grammarAccess.TerminalRule.SemicolonKeyword);
        return this.construct();
    });

    TerminalAlternatives = this.DEFINE_RULE("TerminalAlternatives", TerminalAlternatives.type, () => {
        this.initialize(this.grammarAccess.TerminalAlternatives);
        this.unassignedSubrule(1, this.TerminalGroup, this.grammarAccess.TerminalAlternatives.TerminalGroupRuleCall);
        this.many(1, () => {
            this.executeAction(TerminalAlternatives.type, this.grammarAccess.TerminalAlternatives.TerminalAlternativeselementsAction);
            this.consumeLeaf(1, PipeKeyword, this.grammarAccess.TerminalAlternatives.PipeKeyword);
            this.subruleLeaf(2, this.TerminalGroup, this.grammarAccess.TerminalAlternatives.elementsTerminalGroupRuleCall);
        });
        return this.construct();
    });

    TerminalGroup = this.DEFINE_RULE("TerminalGroup", TerminalGroup.type, () => {
        this.initialize(this.grammarAccess.TerminalGroup);
        this.subruleLeaf(1, this.TerminalToken, this.grammarAccess.TerminalGroup.elementsTerminalTokenRuleCall);
        return this.construct();
    });

    TerminalToken = this.DEFINE_RULE("TerminalToken", TerminalToken.type, () => {
        this.initialize(this.grammarAccess.TerminalToken);
        this.unassignedSubrule(1, this.TerminalTokenElement, this.grammarAccess.TerminalToken.TerminalTokenElementRuleCall);
        this.option(1, () => {
            this.or(1, [
                {
                    ALT: () => {
                        this.consumeLeaf(1, QuestionMarkKeyword, this.grammarAccess.TerminalToken.QuestionMarkKeyword);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(2, AsteriskKeyword, this.grammarAccess.TerminalToken.AsteriskKeyword);
                    }
                },
                {
                    ALT: () => {
                        this.consumeLeaf(3, PlusKeyword, this.grammarAccess.TerminalToken.PlusKeyword);
                    }
                },
            ]);
        });
        return this.construct();
    });

    TerminalTokenElement = this.DEFINE_RULE("TerminalTokenElement", TerminalTokenElement.type, () => {
        this.initialize(this.grammarAccess.TerminalTokenElement);
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
        return this.construct();
    });

    ParenthesizedTerminalElement = this.DEFINE_RULE("ParenthesizedTerminalElement", TerminalAlternatives.type, () => {
        this.initialize(this.grammarAccess.ParenthesizedTerminalElement);
        this.consumeLeaf(1, ParenthesisOpenKeyword, this.grammarAccess.ParenthesizedTerminalElement.ParenthesisOpenKeyword);
        this.unassignedSubrule(1, this.TerminalAlternatives, this.grammarAccess.ParenthesizedTerminalElement.TerminalAlternativesRuleCall);
        this.consumeLeaf(2, ParenthesisCloseKeyword, this.grammarAccess.ParenthesizedTerminalElement.ParenthesisCloseKeyword);
        return this.construct();
    });

    AbstractNegatedToken = this.DEFINE_RULE("AbstractNegatedToken", AbstractNegatedToken.type, () => {
        this.initialize(this.grammarAccess.AbstractNegatedToken);
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
        return this.construct();
    });

    NegatedToken = this.DEFINE_RULE("NegatedToken", NegatedToken.type, () => {
        this.initialize(this.grammarAccess.NegatedToken);
        this.consumeLeaf(1, ExclamationMarkKeyword, this.grammarAccess.NegatedToken.ExclamationMarkKeyword);
        this.subruleLeaf(1, this.TerminalTokenElement, this.grammarAccess.NegatedToken.terminalTerminalTokenElementRuleCall);
        return this.construct();
    });

    UntilToken = this.DEFINE_RULE("UntilToken", UntilToken.type, () => {
        this.initialize(this.grammarAccess.UntilToken);
        this.consumeLeaf(1, DashMoreThanKeyword, this.grammarAccess.UntilToken.DashMoreThanKeyword);
        this.subruleLeaf(1, this.TerminalTokenElement, this.grammarAccess.UntilToken.terminalTerminalTokenElementRuleCall);
        return this.construct();
    });

    Wildcard = this.DEFINE_RULE("Wildcard", Wildcard.type, () => {
        this.initialize(this.grammarAccess.Wildcard);
        this.executeAction(Wildcard.type, this.grammarAccess.Wildcard.WildcardAction);
        this.consumeLeaf(1, DotKeyword, this.grammarAccess.Wildcard.DotKeyword);
        return this.construct();
    });

    CharacterRange = this.DEFINE_RULE("CharacterRange", CharacterRange.type, () => {
        this.initialize(this.grammarAccess.CharacterRange);
        this.subruleLeaf(1, this.Keyword, this.grammarAccess.CharacterRange.leftKeywordRuleCall);
        this.option(1, () => {
            this.consumeLeaf(1, DotDotKeyword, this.grammarAccess.CharacterRange.DotDotKeyword);
            this.subruleLeaf(2, this.Keyword, this.grammarAccess.CharacterRange.rightKeywordRuleCall);
        });
        return this.construct();
    });

    EnumRule = this.DEFINE_RULE("EnumRule", EnumRule.type, () => {
        this.initialize(this.grammarAccess.EnumRule);
        this.consumeLeaf(1, EnumKeyword, this.grammarAccess.EnumRule.EnumKeyword);
        this.consumeLeaf(2, ID, this.grammarAccess.EnumRule.nameIDRuleCall);
        this.option(1, () => {
            this.consumeLeaf(3, ReturnsKeyword, this.grammarAccess.EnumRule.ReturnsKeyword);
            this.consumeLeaf(4, ID, this.grammarAccess.EnumRule.typeIDRuleCall);
        });
        this.consumeLeaf(5, ColonKeyword, this.grammarAccess.EnumRule.ColonKeyword);
        this.subruleLeaf(1, this.EnumLiterals, this.grammarAccess.EnumRule.alternativesEnumLiteralsRuleCall);
        this.consumeLeaf(6, SemicolonKeyword, this.grammarAccess.EnumRule.SemicolonKeyword);
        return this.construct();
    });

    EnumLiterals = this.DEFINE_RULE("EnumLiterals", EnumLiterals.type, () => {
        this.initialize(this.grammarAccess.EnumLiterals);
        this.unassignedSubrule(1, this.EnumLiteralDeclaration, this.grammarAccess.EnumLiterals.EnumLiteralDeclarationRuleCall);
        this.many(1, () => {
            this.executeAction(EnumLiterals.type, this.grammarAccess.EnumLiterals.EnumLiteralselementsAction);
            this.consumeLeaf(1, PipeKeyword, this.grammarAccess.EnumLiterals.PipeKeyword);
            this.subruleLeaf(2, this.EnumLiteralDeclaration, this.grammarAccess.EnumLiterals.elementsEnumLiteralDeclarationRuleCall);
        });
        return this.construct();
    });

    EnumLiteralDeclaration = this.DEFINE_RULE("EnumLiteralDeclaration", EnumLiteralDeclaration.type, () => {
        this.initialize(this.grammarAccess.EnumLiteralDeclaration);
        this.consumeLeaf(1, ID, this.grammarAccess.EnumLiteralDeclaration.enumLiteralIDRuleCall);
        this.option(1, () => {
            this.consumeLeaf(2, EqualsKeyword, this.grammarAccess.EnumLiteralDeclaration.EqualsKeyword);
            this.subruleLeaf(1, this.Keyword, this.grammarAccess.EnumLiteralDeclaration.literalKeywordRuleCall);
        });
        return this.construct();
    });

}
