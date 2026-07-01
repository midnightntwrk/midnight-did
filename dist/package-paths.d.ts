export interface ApiContractConfig {
    readonly privateStateStoreName: "did-private-state";
    readonly zkConfigPath: string;
}
export declare const resolveApiPackageRoot: (moduleUrl: string) => string;
export declare const createContractConfig: (apiPackageRoot: string) => ApiContractConfig;
export declare const currentDir: string;
export declare const contractConfig: ApiContractConfig;
