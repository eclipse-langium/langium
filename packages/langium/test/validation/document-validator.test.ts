/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstUtils } from 'langium';
import type { AstNode, ValidationAcceptor, ValidationChecks } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import type { LangiumServices } from 'langium/lsp';
import type { ValidationResult } from 'langium/test';
import { validationHelper } from 'langium/test';
import { beforeAll, describe, expect, test } from 'vitest';
import { Position, Range } from 'vscode-languageserver';

// Related to https://github.com/eclipse-langium/langium/issues/571
describe('Parser error is thrown on resynced token with NaN position', () => {

    const grammar = `grammar HelloWorld

    entry Model:
        (persons+=Person | greetings+=Greeting)+;

    Person:
        'person' name=ID;

    Greeting:
        'Hello' person=[Person:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    terminal INT returns number: /[0-9]+/;
    terminal STRING: /"[^"]*"|'[^']*'/;
    `;

    let validate: (input: string) => Promise<ValidationResult<AstNode>>;

    beforeAll(async () => {
        const services = await createServicesForGrammar({
            grammar
        });
        validate = validationHelper(services);
    });

    test('Diagnostic is shown on at the end of the previous token', async () => {
        const text = `person Aasdf
        person Jo

        Hello Jo!
        Hello `;

        const validationResult = await validate(text);
        const diagnostics = validationResult.diagnostics;
        expect(diagnostics).toHaveLength(1);
        const endPosition = Position.create(4, 13);
        expect(diagnostics[0].range).toStrictEqual(Range.create(endPosition, endPosition));
    });

    test('Diagnostic is shown at document start when document is empty', async () => {
        const validationResult = await validate('');
        const diagnostics = validationResult.diagnostics;
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].range).toStrictEqual(Range.create(0, 0, 0, 0));
    });
});

describe('Generic `AstNode` validation applies to all nodes', () => {

    const grammar = `grammar GenericAstNode

    entry Model:
        (elements+=(A | B))*;

    A: a=ID;
    B: b=INT;

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    terminal INT returns number: /[0-9]+/;
    `;

    let validate: (input: string) => Promise<ValidationResult<AstNode>>;

    beforeAll(async () => {
        const services = await createServicesForGrammar({
            grammar
        });
        const validationChecks: ValidationChecks<object> = {
            // register two different validations for each AstNode
            AstNode: [
                (node, accept) => {
                    accept('error', 'TEST', { node });
                },
                (node, accept) => {
                    accept('warning', 'Second generic validation', { node });
                }
            ]
        };
        services.validation.ValidationRegistry.register(validationChecks);
        validate = validationHelper(services);
    });

    test('Diagnostics are shown on all elements', async () => {
        const validationResult = await validate('a 42');
        const diagnostics = validationResult.diagnostics;
        // two validations for each AstNode: One for each `element`, once on the root model
        expect(diagnostics).toHaveLength(6);
        expect(diagnostics.filter(d => d.severity === 1)).toHaveLength(3); // 3 errors
        expect(diagnostics.filter(d => d.severity === 2)).toHaveLength(3); // 3 warnings
        expect(diagnostics.filter(d => d.severity === 3)).toHaveLength(0);
        expect(diagnostics.filter(d => d.severity === 4)).toHaveLength(0);
    });

});

describe('Register Before/AfterDocument logic for validations with state', () => {

    // the grammar
    const grammar = `grammar NestedNamedNodes
    entry Model:
        (elements+=NamedNode)*;

    NamedNode:
        name=ID '{' (children+=NamedNode)* '}';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `;

    // AST types derived from the grammar
    type NestedNamedNodesAstTypes = {
        Model: Model;
        NamedNode: NamedNode;
    }
    interface Model extends AstNode {
        $type: 'Model';
        elements: NamedNode[];
    }
    interface NamedNode extends AstNode {
        $type: 'NamedNode';
        $container: Model | NamedNode;
        name: string;
        children: NamedNode[];
    }

    // utilities
    let validate: (input: string) => Promise<ValidationResult<AstNode>>;
    let services: LangiumServices;

    function getFQN(node: AstNode): string {
        if ('name' in node && node.$container) {
            const parentName = getFQN(node.$container);
            if (parentName) {
                return parentName + '.' + node.name;
            }
            return '' + node.name;
        }
        return '';
    }

    function rememberNamedNode(child: NamedNode, fqnMap: Map<string, NamedNode[]>): void {
        const fqn = getFQN(child);
        let list = fqnMap.get(fqn);
        if (!list) {
            list = [];
            fqnMap.set(fqn, list);
        }
        list.push(child);
    }

    function checkForDuplicates(fqnMap: Map<string, NamedNode[]>, accept: ValidationAcceptor): void {
        for (const [key, value] of fqnMap.entries()) {
            if (value.length >= 2) {
                value.forEach(child => accept('error', `The FQN '${key}' is not unique.`, { node: child }));
            }
        }
    }

    // 1. realize validation in state-less way
    function registerValidationForRootElement() {
        const validationChecks: ValidationChecks<NestedNamedNodesAstTypes> = {
            // do the expensive validation once on the root Model only
            Model: (node, accept) => {
                const fqnMap = new Map<string, NamedNode[]>();
                // collect the FQN of all nodes
                // !! This 'streamAllContents' is saved in the alternative version of the validation !!
                AstUtils.streamAllContents(node).forEach(child => {
                    rememberNamedNode(child as NamedNode, fqnMap);
                });
                // check for duplicates
                checkForDuplicates(fqnMap, accept);
            },
        };
        services.validation.ValidationRegistry.register(validationChecks);
    }

    // 2. realize validation without an additional AST traversal by exploiting the stateful validation approach
    function registerValidationBeforeAfter() {
        const fqnMap = new Map<string, NamedNode[]>(); // this is the new state: remember all NamedNode nodes, classified by their name
        services.validation.ValidationRegistry.registerBeforeDocument((_rootNode, _accept, _categories) => {
            fqnMap.clear(); // clear everything to be sure when starting to validate an AST
        });
        services.validation.ValidationRegistry.register(<ValidationChecks<NestedNamedNodesAstTypes>>{
            // register the named nodes in the map (but don't validate/check them now)
            NamedNode: (node, _accept) => {
                // Streaming the whole AST is not required with this approach, since the streaming is already done by the DocumentValidator!
                rememberNamedNode(node, fqnMap);
            },
        });
        services.validation.ValidationRegistry.registerAfterDocument((_rootNode, accept, _categories) => {
            // check for duplicates after all checks for the single nodes of the AST are done
            checkForDuplicates(fqnMap, accept);
            fqnMap.clear(); // free memory afterwards
        });
    }

    // test cases to ensure, that both approaches produce the same validation hints
    describe('Using the stateless validation', () => {
        beforeAll(async () => {
            services = await createServicesForGrammar({
                grammar
            });
            validate = validationHelper(services);
            registerValidationForRootElement();
        });

        test('Children with same name on same level (stateless)', async () => {
            const validationResult = await validate('A { B{} C{} B{} }');
            const diagnostics = validationResult.diagnostics;
            expect(diagnostics).toHaveLength(2);
        });

        test('Nested Children with same name (stateless)', async () => {
            const validationResult = await validate('A { A{ A{} } }');
            const diagnostics = validationResult.diagnostics;
            expect(diagnostics).toHaveLength(0);
        });
    });

    describe('Using the stateful validation', () => {
        beforeAll(async () => {
            services = await createServicesForGrammar({
                grammar
            });
            validate = validationHelper(services);
            registerValidationBeforeAfter();
        });

        test('Children with same name on same level (with state)', async () => {
            const validationResult = await validate('A { B{} C{} B{} }');
            const diagnostics = validationResult.diagnostics;
            expect(diagnostics).toHaveLength(2);
        });

        test('Nested Children with same name (with state)', async () => {
            const validationResult = await validate('A { A{ A{} } }');
            const diagnostics = validationResult.diagnostics;
            expect(diagnostics).toHaveLength(0);
        });
    });

});
