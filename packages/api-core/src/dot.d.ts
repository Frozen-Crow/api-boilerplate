declare namespace doT {
    export interface RenderFunction {
        (data: any): string;
    }
    export function template(tmpl: string, conf?: any, def?: any): RenderFunction;
    export const version: string;
}

declare module 'dot' {
    export = doT;
}
