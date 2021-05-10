import { GeneratorNode, Grammar, IndentNode, CompositeGeneratorNode, NL, process } from 'langium';
import { collectAst, Interface } from './type-collector';

export function generateAst(grammar: Grammar, path?: string): string {
    const types = collectAst(grammar);
    const langiumPath = "'" + (path ?? 'langium') + "'";
    const fileNode = new CompositeGeneratorNode();
    fileNode.children.push(
        '/* eslint-disable @typescript-eslint/array-type */', NL,
        '/* eslint-disable @typescript-eslint/no-namespace */', NL,
        '/* eslint-disable @typescript-eslint/no-explicit-any */', NL,
        '/* eslint-disable @typescript-eslint/no-empty-interface */', NL,
        '/* eslint-disable @typescript-eslint/explicit-module-boundary-types */', NL,
        'import { AstNode, Type, Reference } from ', langiumPath, ';', NL, NL
    );

    for (const type of types) {
        fileNode.children.push(type.toString(), NL);
    }

    fileNode.children.push(generateAstReflection(grammar, types));

    return process(fileNode);
}

type CrossReferenceType = {
    type: string,
    feature: string,
    referenceType: string
}

function generateAstReflection(grammar: Grammar, interfaces: Interface[]): GeneratorNode {
    const reflectionNode = new CompositeGeneratorNode();
    const crossReferenceTypes = buildCrossReferenceTypes(interfaces);
    reflectionNode.children.push('export type AstReference = ', crossReferenceTypes.map(e => `'${e.type}:${e.feature}'`).join(' | '), ';', NL, NL);
    reflectionNode.children.push('export class ', grammar.name, 'AstReflection {', NL, NL);

    const classBodyNode = new IndentNode();
    classBodyNode.children.push('isInstance(node: AstNode, type: string): boolean {', NL);
    const isInstanceNode = new IndentNode();
    isInstanceNode.children.push('return this.isSubtype(node.$type.value, type);', NL);
    classBodyNode.children.push(isInstanceNode, '}', NL, NL);
    classBodyNode.children.push('isSubtype(subtype: string, supertype: string): boolean {', NL);
    classBodyNode.children.push(buildIsSubtypeMethod(interfaces), '}', NL, NL);
    classBodyNode.children.push('getReferenceType(referenceId: AstReference): string {', NL);
    classBodyNode.children.push(buildReferenceTypeMethod(interfaces), '}', NL);
    reflectionNode.children.push(classBodyNode, '}', NL, NL);
    reflectionNode.children.push('export const reflectionInstance = new ', grammar.name, 'AstReflection();', NL);
    return reflectionNode;
}

function buildReferenceTypeMethod(interfaces: Interface[]): GeneratorNode {
    const crossReferenceTypes = buildCrossReferenceTypes(interfaces);
    const typeSwitchNode = new IndentNode();
    typeSwitchNode.children.push('switch (referenceId) {', NL);
    const caseNode = new IndentNode();
    for (const crossRef of crossReferenceTypes) {
        caseNode.children.push(`case '${crossRef.type}:${crossRef.feature}': {`, NL);
        const caseContentNode = new IndentNode();
        caseContentNode.children.push(`return '${crossRef.referenceType}';`, NL);
        caseNode.children.push(caseContentNode, '}', NL);
    }
    caseNode.children.push('default: {', NL);
    const defaultNode = new IndentNode();
    defaultNode.children.push('throw new Error(`${referenceId} is not a valid reference id.`);', NL);
    caseNode.children.push(defaultNode, '}', NL);
    typeSwitchNode.children.push(caseNode, '}', NL);
    return typeSwitchNode;
}

function buildCrossReferenceTypes(interfaces: Interface[]): CrossReferenceType[] {
    const crossReferences: CrossReferenceType[] = [];
    for (const type of interfaces) {
        for (const field of type.fields.filter(e => e.reference)) {
            crossReferences.push({ type: type.name, feature: field.name, referenceType: field.types[0] });
        }
    }
    return crossReferences;
}

function buildIsSubtypeMethod(interfaces: Interface[]): GeneratorNode {
    const methodNode = new IndentNode();
    methodNode.children.push('if (subtype === supertype) {', NL);
    const ifNode = new IndentNode();
    ifNode.children.push('return true;', NL);
    methodNode.children.push(ifNode, '}', NL);
    methodNode.children.push('switch (subtype) {', NL);
    const switchNode = new IndentNode();
    const groups = groupBySupertypes(interfaces.filter(e => e.superTypes.length > 0));

    for (const [superTypes, typeGroup] of Array.from(groups.entries())) {
        for (const typeItem of typeGroup) {
            switchNode.children.push(`case '${typeItem.name}':`, NL);
        }
        switchNode.children.pop();
        switchNode.children.push(' {', NL);
        const caseNode = new IndentNode();
        caseNode.children.push('return ', superTypes.split(':').map(e => `this.isSubtype('${e}', supertype)`).join(' || '), ';');
        switchNode.children.push(caseNode, NL, '}', NL);
    }

    switchNode.children.push('default: {', NL);
    const defaultNode = new IndentNode();
    defaultNode.children.push('return false;', NL);
    switchNode.children.push(defaultNode, '}', NL);
    methodNode.children.push(switchNode, '}', NL);
    return methodNode;
}

function groupBySupertypes(interfaces: Interface[]): Map<string, Interface[]> {
    const map = new Map<string, Interface[]>();
    for (const item of interfaces) {
        const key = item.superTypes.join(':');
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    }
    return map;
}