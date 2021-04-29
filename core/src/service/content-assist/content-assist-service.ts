import { AbstractElement, Grammar, ParserRule, RuleCall } from '../../gen/ast';
import { AstNode, CstNode } from '../../generator/ast-node';
import { findLeafNodeAtOffset } from '../../grammar/grammar-utils';
import { ContentAssistBuilder } from './content-assist-builder';

export function contentAssist(grammar: Grammar, root: AstNode, offset: number): string[] {
    const cst = root[AstNode.cstNode];
    const builder = new ContentAssistBuilder();
    if (cst) {
        const node = findLeafNodeAtOffset(cst, offset);
        if (node) {
            const commonSuperRule = findCommonSuperRule(node);
            commonSuperRule.toString();
            const features = builder.findNextFeatures(buildFeatureStack(node));
            return features.flatMap(e => builder.buildContentAssistFor(e));
        } else {
            return builder.buildContentAssistForRule(grammar.rules[0]);
        }
    } else {
        return [];
    }
}

function buildFeatureStack(node: CstNode | undefined): AbstractElement[] {
    const features: AbstractElement[] = [];
    while (node) {
        if (node.feature) {
            features.push(node.feature);
        }
        node = node.parent;
    }
    return features;
}

function findCommonSuperRule(node: CstNode): ParserRule {
    let superNode = node.parent;
    while (superNode) {
        if (superNode.element !== node.element) {
            const topFeature = node.feature;
            if (RuleCall.is(topFeature) && topFeature.rule.value) {
                return <ParserRule>topFeature.rule.value;
            }
            throw new Error();
        }
        node = superNode;
        superNode = node.parent;
    }
    throw new Error();
}