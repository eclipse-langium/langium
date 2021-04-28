/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'json-cycle' {
    function decycle<T>(value: T): T;
    function retrocycle<T>(value: T): T;
    function parse(value: string, reviver?: (this: any, key: string, value: any) => any): any;
    function stringify(value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string;
}
