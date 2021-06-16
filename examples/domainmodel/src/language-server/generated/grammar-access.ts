import { Action, Assignment, CrossReference, Keyword, RuleCall, GrammarAccess } from 'langium';
import * as path from 'path';

export type DomainmodelRuleAccess = {
    DomainmodelAction: Action;
    elements: Assignment;
    elementsAbstractElementRuleCall: RuleCall;
}

export type PackageDeclarationRuleAccess = {
    PackageKeyword: Keyword;
    name: Assignment;
    nameQualifiedNameRuleCall: RuleCall;
    CurlyOpenKeyword: Keyword;
    elements: Assignment;
    elementsAbstractElementRuleCall: RuleCall;
    CurlyCloseKeyword: Keyword;
}

export type AbstractElementRuleAccess = {
    PackageDeclarationRuleCall: RuleCall;
    TypeRuleCall: RuleCall;
    ImportRuleCall: RuleCall;
}

export type QualifiedNameRuleAccess = {
    IDRuleCall: RuleCall;
    DotKeyword: Keyword;
}

export type ImportRuleAccess = {
    ImportKeyword: Keyword;
    importedNamespace: Assignment;
    importedNamespaceQualifiedNameWithWildcardRuleCall: RuleCall;
}

export type QualifiedNameWithWildcardRuleAccess = {
    QualifiedNameRuleCall: RuleCall;
    DotAsteriskKeyword: Keyword;
}

export type TypeRuleAccess = {
    DataTypeRuleCall: RuleCall;
    EntityRuleCall: RuleCall;
}

export type DataTypeRuleAccess = {
    DatatypeKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
}

export type EntityRuleAccess = {
    EntityKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
    ExtendsKeyword: Keyword;
    superType: Assignment;
    superTypeEntityCrossReference: CrossReference;
    CurlyOpenKeyword: Keyword;
    features: Assignment;
    featuresFeatureRuleCall: RuleCall;
    CurlyCloseKeyword: Keyword;
}

export type FeatureRuleAccess = {
    many: Assignment;
    ManyKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
    ColonKeyword: Keyword;
    type: Assignment;
    typeTypeCrossReference: CrossReference;
}

export class DomainModelGrammarAccess extends GrammarAccess {
    Domainmodel = this.buildAccess<DomainmodelRuleAccess>('Domainmodel');
    PackageDeclaration = this.buildAccess<PackageDeclarationRuleAccess>('PackageDeclaration');
    AbstractElement = this.buildAccess<AbstractElementRuleAccess>('AbstractElement');
    QualifiedName = this.buildAccess<QualifiedNameRuleAccess>('QualifiedName');
    Import = this.buildAccess<ImportRuleAccess>('Import');
    QualifiedNameWithWildcard = this.buildAccess<QualifiedNameWithWildcardRuleAccess>('QualifiedNameWithWildcard');
    Type = this.buildAccess<TypeRuleAccess>('Type');
    DataType = this.buildAccess<DataTypeRuleAccess>('DataType');
    Entity = this.buildAccess<EntityRuleAccess>('Entity');
    Feature = this.buildAccess<FeatureRuleAccess>('Feature');

    constructor() {
        super(path.join(__dirname, 'grammar.json'));
    }
}
