/******************************************************************************
 * This file was generated by langium-cli 3.5.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

/* eslint-disable */
import * as langium from 'langium';

export const RequirementsAndTestsTerminals = {
    WS: /\s+/,
    ID: /[_a-zA-Z][\w_]*/,
    STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/,
    ML_COMMENT: /\/\*[\s\S]*?\*\//,
    SL_COMMENT: /\/\/[^\n\r]*/,
};

export type RequirementsAndTestsTerminalNames = keyof typeof RequirementsAndTestsTerminals;

export type RequirementsAndTestsKeywordNames =
    | ","
    | ":"
    | "="
    | "applicable"
    | "contact"
    | "environment"
    | "for"
    | "req"
    | "testFile"
    | "tests"
    | "tst";

export type RequirementsAndTestsTokenNames = RequirementsAndTestsTerminalNames | RequirementsAndTestsKeywordNames;

export interface Contact extends langium.AstNode {
    readonly $container: RequirementModel | TestModel;
    readonly $type: 'Contact';
    user_name: string;
}

export const Contact = 'Contact';

export function isContact(item: unknown): item is Contact {
    return reflection.isInstance(item, Contact);
}

export interface Environment extends langium.AstNode {
    readonly $container: RequirementModel;
    readonly $type: 'Environment';
    description: string;
    name: string;
}

export const Environment = 'Environment';

export function isEnvironment(item: unknown): item is Environment {
    return reflection.isInstance(item, Environment);
}

export interface Requirement extends langium.AstNode {
    readonly $container: RequirementModel;
    readonly $type: 'Requirement';
    environments: Array<langium.Reference<Environment>>;
    name: string;
    text: string;
}

export const Requirement = 'Requirement';

export function isRequirement(item: unknown): item is Requirement {
    return reflection.isInstance(item, Requirement);
}

export interface RequirementModel extends langium.AstNode {
    readonly $type: 'RequirementModel';
    contact?: Contact;
    environments: Array<Environment>;
    requirements: Array<Requirement>;
}

export const RequirementModel = 'RequirementModel';

export function isRequirementModel(item: unknown): item is RequirementModel {
    return reflection.isInstance(item, RequirementModel);
}

export interface Test extends langium.AstNode {
    readonly $container: TestModel;
    readonly $type: 'Test';
    environments: Array<langium.Reference<Environment>>;
    name: string;
    requirements: Array<langium.Reference<Requirement>>;
    testFile?: string;
}

export const Test = 'Test';

export function isTest(item: unknown): item is Test {
    return reflection.isInstance(item, Test);
}

export interface TestModel extends langium.AstNode {
    readonly $type: 'TestModel';
    contact?: Contact;
    tests: Array<Test>;
}

export const TestModel = 'TestModel';

export function isTestModel(item: unknown): item is TestModel {
    return reflection.isInstance(item, TestModel);
}

export type RequirementsAndTestsAstType = {
    Contact: Contact
    Environment: Environment
    Requirement: Requirement
    RequirementModel: RequirementModel
    Test: Test
    TestModel: TestModel
}

export class RequirementsAndTestsAstReflection extends langium.AbstractAstReflection {

    getAllTypes(): string[] {
        return [Contact, Environment, Requirement, RequirementModel, Test, TestModel];
    }

    protected override computeIsSubtype(subtype: string, supertype: string): boolean {
        switch (subtype) {
            default: {
                return false;
            }
        }
    }

    getReferenceType(refInfo: langium.ReferenceInfo): string {
        const referenceId = `${refInfo.container.$type}:${refInfo.property}`;
        switch (referenceId) {
            case 'Requirement:environments':
            case 'Test:environments': {
                return Environment;
            }
            case 'Test:requirements': {
                return Requirement;
            }
            default: {
                throw new Error(`${referenceId} is not a valid reference id.`);
            }
        }
    }

    getTypeMetaData(type: string): langium.TypeMetaData {
        switch (type) {
            case Contact: {
                return {
                    name: Contact,
                    properties: [
                        { name: 'user_name' }
                    ]
                };
            }
            case Environment: {
                return {
                    name: Environment,
                    properties: [
                        { name: 'description' },
                        { name: 'name' }
                    ]
                };
            }
            case Requirement: {
                return {
                    name: Requirement,
                    properties: [
                        { name: 'environments', defaultValue: [] },
                        { name: 'name' },
                        { name: 'text' }
                    ]
                };
            }
            case RequirementModel: {
                return {
                    name: RequirementModel,
                    properties: [
                        { name: 'contact' },
                        { name: 'environments', defaultValue: [] },
                        { name: 'requirements', defaultValue: [] }
                    ]
                };
            }
            case Test: {
                return {
                    name: Test,
                    properties: [
                        { name: 'environments', defaultValue: [] },
                        { name: 'name' },
                        { name: 'requirements', defaultValue: [] },
                        { name: 'testFile' }
                    ]
                };
            }
            case TestModel: {
                return {
                    name: TestModel,
                    properties: [
                        { name: 'contact' },
                        { name: 'tests', defaultValue: [] }
                    ]
                };
            }
            default: {
                return {
                    name: type,
                    properties: []
                };
            }
        }
    }
}

export const reflection = new RequirementsAndTestsAstReflection();
