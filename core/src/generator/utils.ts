import * as ast from '../grammar-lang/generated/ast';
import { replaceTokens } from './token-replacer';

type FeatureValue = {
    feature: ast.AbstractElement;
    kind: 'Keyword' | 'RuleCall' | 'Assignment' | 'CrossReference' | 'Action';
}

export type Cardinality = '?' | '*' | '+' | undefined;
export type Operator = '=' | '+=' | '?=' | undefined;

export function isOptional(cardinality?: Cardinality): boolean {
    return cardinality === '?' || cardinality === '*';
}

export function isArray(cardinality?: Cardinality): boolean {
    return cardinality === '*' || cardinality === '+';
}

export function isArrayOperator(operator?: Operator): boolean {
    return operator === '+=';
}

export function isDataTypeRule(rule: ast.ParserRule): boolean {
    const features = Array.from(findAllFeatures(rule).byFeature.keys());
    const onlyRuleCallsAndKeywords = features.every(e => ast.isRuleCall(e) || ast.isKeyword(e) || ast.isGroup(e) || ast.isAlternatives(e) || ast.isUnorderedGroup(e));
    if (onlyRuleCallsAndKeywords) {
        const ruleCallWithParserRule = features.filter(e => ast.isRuleCall(e) && ast.isParserRule(e.rule.value) && !isDataTypeRule(e.rule.value));
        return ruleCallWithParserRule.length === 0;
    }
    return false;
}

export function findAllFeatures(rule: ast.ParserRule): { byName: Map<string, FeatureValue>, byFeature: Map<ast.AbstractElement, string> } {
    const map = new Map<string, FeatureValue>();
    const featureMap = new Map<ast.AbstractElement, string>();
    putFeature(rule.alternatives, undefined, map, featureMap);
    const newMap = new Map<string, FeatureValue>();
    for (const [key, value] of Array.from(map.entries())) {
        newMap.set(key.replace(/\^/g, ''), value);
    }
    const newFeatureMap = new Map<ast.AbstractElement, string>();
    for (const [key, value] of Array.from(featureMap.entries())) {
        newFeatureMap.set(key, value.replace(/\^/g, ''));
    }
    return { byName: newMap, byFeature: newFeatureMap };
}

function putFeature(element: ast.AbstractElement, previous: string | undefined, byName: Map<string, FeatureValue>, byFeature: Map<ast.AbstractElement, string>) {
    if (ast.isAssignment(element)) {
        const fullName = (previous ?? '') + element.feature;
        byName.set(fullName, { feature: element, kind: 'Assignment' });
        byFeature.set(element, fullName);
        putFeature(element.terminal, fullName, byName, byFeature);
    } else if (ast.isRuleCall(element)) {
        const name = (previous ?? '') + element.rule.value?.name + 'RuleCall';
        byName.set(name, { feature: element, kind: 'RuleCall' });
        byFeature.set(element, name);
    } else if (ast.isCrossReference(element)) {
        const name = (previous ?? '') + element.type.value?.name + 'CrossReference';
        byName.set(name, { feature: element, kind: 'CrossReference' });
        byFeature.set(element, name);
    } else if (ast.isKeyword(element)) {
        const validName = replaceTokens(element.value) + 'Keyword';
        byName.set(validName, { feature: element, kind: 'Keyword' });
        byFeature.set(element, validName);
    } else if (ast.isAction(element)) {
        const name = (previous ?? '') + element.type + (element.feature ?? '') + 'Action';
        byName.set(name, { feature: element, kind: 'Action' });
        byFeature.set(element, name);
    } else if (ast.isAlternatives(element) || ast.isUnorderedGroup(element) || ast.isGroup(element)) {
        for (const subFeature of element.elements) {
            putFeature(subFeature, previous, byName, byFeature);
        }
    }
}
