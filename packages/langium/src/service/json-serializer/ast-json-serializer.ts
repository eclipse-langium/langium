/* eslint-disable @typescript-eslint/no-explicit-any */
import { AstNode, Reference } from '../../syntax-tree';
import { Linker } from '../../references/linker';
import { LangiumServices } from '../../services';

export class AstJsonSerializer {

    private readonly linker: Linker;

    constructor(services: LangiumServices) {
        this.linker = services.references.Linker;
    }

    serialize(node: AstNode): string {
        return JSON.stringify(this.decycle(node, '$container', '$document', '$cstNode'));
    }

    deserialize(content: string): AstNode {
        return this.retrocycle(JSON.parse(content));
    }

    decycle(object: Record<string, any>, ...ignore: string[]): any {
        const objects = new Set<any>(); // Keep references to each unique object

        const replace = (item: Record<string, any>) => {
            // The replace function recurses through the object, producing the deep copy.
            if (typeof item === 'object' && item !== null) {
                if (objects.has(item)) {
                    throw new Error('Cycle in ast detected.');
                } else {
                    objects.add(item);
                }
                if (Reference.is(item)) {
                    return { $refName: item.$refName };
                }
                let newItem: Record<string, any>;
                // If it is an array, replicate the array.
                if (Array.isArray(item)) {
                    newItem = [];
                    for (let i = 0; i < item.length; i++) {
                        newItem[i] = replace(item[i]);
                    }
                } else {
                    // If it is an object, replicate the object.
                    newItem = {};
                    for (const [name, itemValue] of Object.entries(item)) {
                        if (this.isPlainProperty(item, name) && !ignore.includes(name)) {
                            newItem[name] = replace(itemValue);
                        }
                    }
                }
                return newItem;
            }
            return item;
        };
        return replace(object);
    }

    protected isPlainProperty(object: Record<string, any>, propertyName: string): boolean {
        const descriptor = Object.getOwnPropertyDescriptor(object, propertyName);
        if (descriptor !== undefined)
            return descriptor.get === undefined;
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    retrocycle(object: any): any {
        const link = this.linker.link.bind(this.linker);
        const revive = (value: Record<string, any>, container?: unknown, propName?: string) => {

            // The revive function walks recursively through the object looking for $ref
            // properties. When it finds one that has a value that is a path, then it
            // replaces the $ref object with a reference to the value that is found by
            // the path.

            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (Reference.is(item)) {
                            const referenceId = `${(container as any).$type}:${propName}`;
                            Object.defineProperty(item, 'ref', {
                                get: () => link(container as AstNode, item.$refName, referenceId)
                            });
                        } else if (item && typeof item === 'object') {
                            revive(item, item);
                            item.$container = container;
                        }
                    }
                } else {
                    for (const [name, item] of Object.entries(value)) {
                        if (typeof item === 'object') {
                            if (Reference.is(item)) {
                                const referenceId = `${value.$type}:${name}`;
                                Object.defineProperty(item, 'ref', {
                                    get: () => link(value as AstNode, item.$refName, referenceId)
                                });
                            } else if (item) {
                                if(Array.isArray(item)) {
                                    revive(item, value, name);
                                } else {
                                    revive(item);
                                    item.$container = value;
                                }
                            }
                        }
                    }
                }
            }
        };
        revive(object);
        return object;
    }
}
