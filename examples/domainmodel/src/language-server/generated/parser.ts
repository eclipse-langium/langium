/* eslint-disable */
// @ts-nocheck
import { createToken, Lexer } from 'chevrotain';
import { LangiumParser, LangiumServices, Number, String } from 'langium';
import { DomainModelGrammarAccess } from './grammar-access';
import { AbstractElement, Domainmodel, Feature, Type, Import, PackageDeclaration, DataType, Entity, } from './ast';

const ID = createToken({ name: 'ID', pattern: /[_a-zA-Z][\w_]*/ });
const INT = createToken({ name: 'INT', pattern: /[0-9]+/ });
const STRING = createToken({ name: 'STRING', pattern: /"[^"]*"|'[^']*'/ });
const WS = createToken({ name: 'WS', pattern: /\s+/, group: Lexer.SKIPPED });
const DatatypeKeyword = createToken({ name: 'DatatypeKeyword', pattern: /datatype/, longer_alt: ID });
const ExtendsKeyword = createToken({ name: 'ExtendsKeyword', pattern: /extends/, longer_alt: ID });
const PackageKeyword = createToken({ name: 'PackageKeyword', pattern: /package/, longer_alt: ID });
const EntityKeyword = createToken({ name: 'EntityKeyword', pattern: /entity/, longer_alt: ID });
const ImportKeyword = createToken({ name: 'ImportKeyword', pattern: /import/, longer_alt: ID });
const ManyKeyword = createToken({ name: 'ManyKeyword', pattern: /many/, longer_alt: ID });
const DotAsteriskKeyword = createToken({ name: 'DotAsteriskKeyword', pattern: /\.\*/, longer_alt: ID });
const ColonKeyword = createToken({ name: 'ColonKeyword', pattern: /:/, longer_alt: ID });
const DotKeyword = createToken({ name: 'DotKeyword', pattern: /\./, longer_alt: DotAsteriskKeyword });
const CurlyOpenKeyword = createToken({ name: 'CurlyOpenKeyword', pattern: /\{/, longer_alt: ID });
const CurlyCloseKeyword = createToken({ name: 'CurlyCloseKeyword', pattern: /\}/, longer_alt: ID });

ColonKeyword.LABEL = "':'";
DotKeyword.LABEL = "'.'";
DotAsteriskKeyword.LABEL = "'.*'";
CurlyOpenKeyword.LABEL = "'{'";
CurlyCloseKeyword.LABEL = "'}'";
DatatypeKeyword.LABEL = "'datatype'";
EntityKeyword.LABEL = "'entity'";
ExtendsKeyword.LABEL = "'extends'";
ImportKeyword.LABEL = "'import'";
ManyKeyword.LABEL = "'many'";
PackageKeyword.LABEL = "'package'";
const tokens = [DatatypeKeyword, ExtendsKeyword, PackageKeyword, EntityKeyword, ImportKeyword, ManyKeyword, DotAsteriskKeyword, ColonKeyword, DotKeyword, CurlyOpenKeyword, CurlyCloseKeyword, ID, INT, STRING, WS];

export class Parser extends LangiumParser {
    readonly grammarAccess: DomainModelGrammarAccess;

    constructor(services: LangiumServices) {
        super(tokens, services);
    }

    Domainmodel = this.MAIN_RULE("Domainmodel", Domainmodel, () => {
        this.initializeElement(this.grammarAccess.Domainmodel);
        this.action(Domainmodel, this.grammarAccess.Domainmodel.DomainmodelAction);
        this.many(1, () => {
            this.subrule(1, this.AbstractElement, this.grammarAccess.Domainmodel.elementsAbstractElementRuleCall);
        });
        return this.construct();
    });

    PackageDeclaration = this.DEFINE_RULE("PackageDeclaration", PackageDeclaration, () => {
        this.initializeElement(this.grammarAccess.PackageDeclaration);
        this.consume(1, PackageKeyword, this.grammarAccess.PackageDeclaration.PackageKeyword);
        this.subrule(1, this.QualifiedName, this.grammarAccess.PackageDeclaration.nameQualifiedNameRuleCall);
        this.consume(2, CurlyOpenKeyword, this.grammarAccess.PackageDeclaration.CurlyOpenKeyword);
        this.many(1, () => {
            this.subrule(2, this.AbstractElement, this.grammarAccess.PackageDeclaration.elementsAbstractElementRuleCall);
        });
        this.consume(3, CurlyCloseKeyword, this.grammarAccess.PackageDeclaration.CurlyCloseKeyword);
        return this.construct();
    });

    AbstractElement = this.DEFINE_RULE("AbstractElement", AbstractElement, () => {
        this.initializeElement(this.grammarAccess.AbstractElement);
        this.or(1, [
            () => {
                this.unassignedSubrule(1, this.PackageDeclaration, this.grammarAccess.AbstractElement.PackageDeclarationRuleCall);
            },
            () => {
                this.unassignedSubrule(2, this.Type, this.grammarAccess.AbstractElement.TypeRuleCall);
            },
            () => {
                this.unassignedSubrule(3, this.Import, this.grammarAccess.AbstractElement.ImportRuleCall);
            },
        ]);
        return this.construct();
    });

    QualifiedName = this.DEFINE_RULE("QualifiedName", 'String', () => {
        this.initializeElement(this.grammarAccess.QualifiedName);
        this.consume(1, ID, this.grammarAccess.QualifiedName.IDRuleCall);
        this.many(1, () => {
            this.consume(2, DotKeyword, this.grammarAccess.QualifiedName.DotKeyword);
            this.consume(3, ID, this.grammarAccess.QualifiedName.IDRuleCall);
        });
        return this.construct();
    });

    Import = this.DEFINE_RULE("Import", Import, () => {
        this.initializeElement(this.grammarAccess.Import);
        this.consume(1, ImportKeyword, this.grammarAccess.Import.ImportKeyword);
        this.subrule(1, this.QualifiedNameWithWildcard, this.grammarAccess.Import.importedNamespaceQualifiedNameWithWildcardRuleCall);
        return this.construct();
    });

    QualifiedNameWithWildcard = this.DEFINE_RULE("QualifiedNameWithWildcard", 'String', () => {
        this.initializeElement(this.grammarAccess.QualifiedNameWithWildcard);
        this.unassignedSubrule(1, this.QualifiedName, this.grammarAccess.QualifiedNameWithWildcard.QualifiedNameRuleCall);
        this.option(1, () => {
            this.consume(1, DotAsteriskKeyword, this.grammarAccess.QualifiedNameWithWildcard.DotAsteriskKeyword);
        });
        return this.construct();
    });

    Type = this.DEFINE_RULE("Type", Type, () => {
        this.initializeElement(this.grammarAccess.Type);
        this.or(1, [
            () => {
                this.unassignedSubrule(1, this.DataType, this.grammarAccess.Type.DataTypeRuleCall);
            },
            () => {
                this.unassignedSubrule(2, this.Entity, this.grammarAccess.Type.EntityRuleCall);
            },
        ]);
        return this.construct();
    });

    DataType = this.DEFINE_RULE("DataType", DataType, () => {
        this.initializeElement(this.grammarAccess.DataType);
        this.consume(1, DatatypeKeyword, this.grammarAccess.DataType.DatatypeKeyword);
        this.consume(2, ID, this.grammarAccess.DataType.nameIDRuleCall);
        return this.construct();
    });

    Entity = this.DEFINE_RULE("Entity", Entity, () => {
        this.initializeElement(this.grammarAccess.Entity);
        this.consume(1, EntityKeyword, this.grammarAccess.Entity.EntityKeyword);
        this.consume(2, ID, this.grammarAccess.Entity.nameIDRuleCall);
        this.option(1, () => {
            this.consume(3, ExtendsKeyword, this.grammarAccess.Entity.ExtendsKeyword);
            this.consume(4, ID, this.grammarAccess.Entity.superTypeEntityCrossReference);
        });
        this.consume(5, CurlyOpenKeyword, this.grammarAccess.Entity.CurlyOpenKeyword);
        this.many(1, () => {
            this.subrule(1, this.Feature, this.grammarAccess.Entity.featuresFeatureRuleCall);
        });
        this.consume(6, CurlyCloseKeyword, this.grammarAccess.Entity.CurlyCloseKeyword);
        return this.construct();
    });

    Feature = this.DEFINE_RULE("Feature", Feature, () => {
        this.initializeElement(this.grammarAccess.Feature);
        this.option(1, () => {
            this.consume(1, ManyKeyword, this.grammarAccess.Feature.ManyKeyword);
        });
        this.consume(2, ID, this.grammarAccess.Feature.nameIDRuleCall);
        this.consume(3, ColonKeyword, this.grammarAccess.Feature.ColonKeyword);
        this.consume(4, ID, this.grammarAccess.Feature.typeTypeCrossReference);
        return this.construct();
    });

}
