import { AbstractElement, Action, Alternatives, Assignment, CrossReference, Grammar, Group, Keyword, ParserRule, RuleCall, UnorderedGroup } from '../gen/ast';
import { getTypeName } from '../grammar/grammar-utils';
import { CompositeGeneratorNode, IndentNode, NL } from './node/node';
import { process } from './node/node-processor';
import { Cardinality, isDataTypeRule, isOptionalCardinality } from './utils';

type TypeAlternative = {
    name: string,
    super: string[],
    fields: Field[]
    ruleCalls: string[],
    hasAction: boolean
}

type Field = {
    name: string,
    array: boolean,
    optional: boolean,
    types: string[]
}

export class Interface {
    name: string;
    superTypes: string[];
    fields: Field[];

    constructor(name: string, superTypes: string[], fields: Field[]) {
        this.name = name;
        this.superTypes = Array.from(new Set<string>(superTypes));
        this.fields = fields;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        const superTypes = this.superTypes.length > 0 ? this.superTypes : [ 'AstNode' ];
        interfaceNode.children.push('export interface ', this.name, ' extends ', superTypes.join(', '), ' {', NL);
        const fieldsNode = new IndentNode();
        for (const field of this.fields) {
            fieldsNode.children.push(field.name, field.optional ? '?' : '', ': ', field.types.join(' | '), field.array ? '[]' : '', NL);
        }
        interfaceNode.children.push(fieldsNode, '}', NL, NL);
        interfaceNode.children.push('export namespace ', this.name, ' {', NL);
        const interfaceBody = new IndentNode();
        interfaceBody.children.push("export const kind: Kind = { value: '", this.name, "', get super() { return [ ", superTypes.map(e => e + '.kind').join(', '), ' ]; }};', NL);
        const methodBody = new IndentNode();
        interfaceBody.children.push('export function is(item: any): item is ', this.name, ' {', NL, methodBody, '}');
        methodBody.children.push('return AstNode.is(item, kind);', NL);
        interfaceNode.children.push(interfaceBody, NL, '}', NL);

        return process(interfaceNode);
    }
}

export function collectAst(grammar: Grammar): Interface[] {
    const collector = new TypeCollector();

    const parserRules = grammar.rules.filter(e => ParserRule.is(e) && !e.fragment && !isDataTypeRule(e)).map(e => e as ParserRule);

    for (const rule of parserRules) {
        collector.addAlternative(getTypeName(rule));
        collectElement(collector, rule.alternatives);
    }

    return collector.calculateAst();
}

function collectElement(collector: TypeCollector, element: AbstractElement): void {
    collector.enterGroup(element.cardinality);
    if (Alternatives.is(element) || UnorderedGroup.is(element) || Group.is(element)) {
        for (const item of element.elements) {
            collectElement(collector, item);
        }
    } else if (Action.is(element)) {
        collector.addAction(element);
    } else if (Assignment.is(element)) {
        collector.addAssignment(element);
    } else if (RuleCall.is(element)) {
        collector.addRuleCall(element);
    }
    collector.leaveGroup();
}

export class TypeCollector {

    private alternatives: TypeAlternative[] = [];
    private cardinalities: Cardinality[] = [];
    private lastRuleCall?: RuleCall;

    private get currentAlternative(): TypeAlternative {
        return this.alternatives[this.alternatives.length - 1];
    }

    clear(): void {
        this.cardinalities = [];
        this.alternatives = [];
    }

    addAlternative(name: string): void {
        this.alternatives.push({ name, super: [], fields: [], ruleCalls: [], hasAction: false });
    }

    addAction(action: Action): void {
        if (action.type !== this.currentAlternative.name) {
            this.currentAlternative.super.push(this.currentAlternative.name);
        }
        this.currentAlternative.hasAction = true;
        this.currentAlternative.name = action.type;
        if (action.feature && action.operator) {
            if (this.lastRuleCall) {
                this.currentAlternative.fields.push({
                    name: this.clean(action.feature),
                    array: action.operator === '+=',
                    optional: false,
                    types: [getTypeName(this.lastRuleCall.rule)]
                });
            } else {
                throw new Error('Actions with features can only be called after an unassigned rule call');
            }
        }
    }

    addAssignment(assignment: Assignment): void {
        let card: Cardinality = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyConv = <any>assignment;
        if ('cardinality' in anyConv) {
            card = <Cardinality>anyConv.cardinality;
        }
        this.currentAlternative.fields.push({
            name: this.clean(assignment.feature),
            array: assignment.operator === '+=',
            optional: isOptionalCardinality(card) || this.isOptional(),
            types: assignment.operator === '?=' ? ['boolean'] : this.findTypes(assignment.terminal)
        });
    }

    addRuleCall(ruleCall: RuleCall): void {
        const rule = ruleCall.rule;
        if (ParserRule.is(rule) && rule.fragment) {
            const collector = new TypeCollector();
            collector.addAlternative(rule.name);
            collectElement(collector, rule.alternatives);
            const types = collector.calculateAst();
            const type = types.find(e => e.name === rule.name);
            if (type) {
                this.currentAlternative.fields.push(...type.fields);
            }
        } else if (ParserRule.is(rule)) {
            this.currentAlternative.ruleCalls.push(getTypeName(rule));
            this.lastRuleCall = ruleCall;
        }
    }

    enterGroup(cardinality: Cardinality): void {
        this.cardinalities.push(cardinality);
    }

    leaveGroup(): void {
        this.cardinalities.pop();
    }

    protected isOptional(): boolean {
        return this.cardinalities.some(e => e === '*' || e === '?');
    }

    protected findTypes(terminal: AbstractElement): string[] {
        const types: string[] = [];

        if (Alternatives.is(terminal) || UnorderedGroup.is(terminal) || Group.is(terminal)) {
            types.push(...this.findInCollection(terminal));
        } else if (Keyword.is(terminal)) {
            types.push(terminal.value);
        } else if (RuleCall.is(terminal)) {
            types.push(getTypeName(terminal.rule));
        } else if (CrossReference.is(terminal)) {
            types.push(getTypeName(terminal.type));
        }
        return types;
    }

    protected findInCollection(collection: Alternatives | Group | UnorderedGroup): string[] {
        const types: string[] = [];
        for (const element of collection.elements) {
            types.push(...this.findTypes(element));
        }
        return types;
    }

    // TODO: Optimize/simplify this method
    protected flattenTypes(alternatives: TypeAlternative[]): TypeAlternative[] {
        const names = new Set<string>(alternatives.map(e => e.name));
        const types: TypeAlternative[] = [];

        for (const name of Array.from(names)) {
            const fields: Field[] = [];
            const ruleCalls = new Set<string>();
            const type = { name, fields, ruleCalls: <string[]>[], super: <string[]>[], hasAction: false };
            const namedAlternatives = alternatives.filter(e => e.name === name);
            for (const alt of namedAlternatives) {
                type.super.push(...alt.super);
                type.hasAction = type.hasAction || alt.hasAction;
                const altFields = alt.fields;
                for (const altField of altFields) {
                    const existingField = fields.find(e => e.name === altField.name);
                    if (existingField) {
                        existingField.optional = existingField.optional && altField.optional;
                        const typeSet = new Set(existingField.types);
                        for (const type of altField.types) {
                            typeSet.add(type);
                        }
                        existingField.types = Array.from(typeSet.values());
                    } else {
                        fields.push({ ...altField });
                    }
                }
                if (altFields.length === 0) {
                    for (const ruleCall of alt.ruleCalls) {
                        ruleCalls.add(ruleCall);
                    }
                }
            }
            type.ruleCalls = Array.from(ruleCalls);
            types.push(type);
        }

        return types;
    }

    calculateAst(): Interface[] {
        const interfaces: Interface[] = [];
        const ruleCallAlternatives: TypeAlternative[] = [];
        const flattened = this.flattenTypes(this.alternatives);

        for (const flat of flattened) {
            if (flat.fields.length > 0 || flat.hasAction) {
                const type = new Interface(flat.name, flat.super, flat.fields);
                interfaces.push(type);
            }
            if (flat.ruleCalls.length > 0) {
                ruleCallAlternatives.push(flat);
            }
            // all other cases assume we have a data type rule
            // we do not generate an AST type for data type rules
        }

        for (const ruleCallType of ruleCallAlternatives) {
            let exists = false;
            for (const ruleCall of ruleCallType.ruleCalls) {
                const calledInterface = interfaces.find(e => e.name === ruleCall);
                if (calledInterface && calledInterface.name === ruleCallType.name) {
                    exists = true;
                } else if (calledInterface) {
                    calledInterface.superTypes.push(ruleCallType.name);
                }
            }
            if (!exists) {
                interfaces.push(new Interface(ruleCallType.name, ruleCallType.super, []));
            }
        }
        this.liftFields(interfaces);

        return interfaces;
    }

    private liftFields(interfaces: Interface[]): void {
        for (const interfaceType of interfaces) {
            const subInterfaces = interfaces.filter(e => e.superTypes.includes(interfaceType.name));
            const first = subInterfaces[0];
            if (first) {
                const removal: Field[] = [];
                for (const field of first.fields) {
                    if (subInterfaces.every(e => e.fields.some(f => f.name === field.name))) {
                        if (!interfaceType.fields.some(e => e.name === field.name)) {
                            interfaceType.fields.push(field);
                        }
                        removal.push(field);
                    }
                }
                for (const remove of removal) {
                    for (const subInterface of subInterfaces) {
                        const index = subInterface.fields.findIndex(e => e.name === remove.name);
                        subInterface.fields.splice(index, 1);
                    }
                }
            }
        }
    }

    private clean(value: string): string {
        if (value.startsWith('^')) {
            return value.substring(1);
        } else {
            return value;
        }
    }

}