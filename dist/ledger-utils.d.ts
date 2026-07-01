export type BoundIdField = "verificationMethod.id" | "schnorrJubjubVerificationMethod.id" | "service.id" | "methodId" | "serviceId";
export declare const normalizeFragmentId: (value: string) => string;
export declare const normalizeBoundFragmentId: (value: string, field: BoundIdField, expectedDidSubject: string) => string;
export declare const serviceTypeToLedger: (serviceType: string | string[]) => string;
export declare const serviceEndpointToLedger: (endpoint: unknown) => string;
export declare const assertAbsoluteUri: (value: string, field?: string) => string;
//# sourceMappingURL=ledger-utils.d.ts.map