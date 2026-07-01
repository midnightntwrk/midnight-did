import { z } from "zod/v4-mini";
import { decodeBase64UrlBytes32 } from "./crypto-codecs.js";
/** DID URL schema */
export const DIDURLSchema = z
    .string()
    .check(z.startsWith("did:"), z.minLength(5), z.refine((val) => val.split(":").length >= 3, "Invalid DID URL format"))
    .brand("DIDURL");
export const KeyIDSchema = z
    .string()
    .check(z.regex(/^[a-zA-Z0-9.\-_:%]+$/), // conservative URI fragment charset
z.minLength(1))
    .brand("KeyID");
const hasUriScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const isRelativeReference = (value) => {
    if (typeof value !== "string")
        return false;
    if (value.length === 0)
        return false;
    if (value.trim() !== value)
        return false;
    if (hasUriScheme.test(value))
        return false;
    if (value.startsWith("//"))
        return false;
    try {
        new URL(value, "https://example.org");
        return true;
    }
    catch {
        return false;
    }
};
export const RelativeURLSchema = z
    .string()
    .check(z.refine(isRelativeReference, "Relative URL must be relative to the DID subject"))
    .brand("RelativeURL");
const extractKeyFragment = (value) => {
    if (value.startsWith("#"))
        return value.slice(1);
    if (value.startsWith("did:")) {
        const fragmentIndex = value.indexOf("#");
        if (fragmentIndex === -1)
            return "";
        return value.substring(fragmentIndex + 1);
    }
    return value;
};
/** DID Key ID (e.g. did:example:123#key-1 or #key-1) */
export const DIDKeyIDSchema = z
    .union([DIDURLSchema, RelativeURLSchema])
    .check(z.refine((val) => {
    const fragment = extractKeyFragment(val);
    return fragment.length > 0 && KeyIDSchema.safeParse(fragment).success;
}, "Invalid DID Key ID format: invalid or missing fragment"))
    .brand("DIDKeyID");
/** DID schema (no path/query/fragment) */
export const DIDStringSchema = z
    .string()
    .check(z.startsWith("did:"), z.minLength(5), z.refine((val) => val.split(":").length >= 3 && !/[/?#]/.test(val), {
    error: "Invalid DID format",
}))
    .brand("DID");
/** Verification Method Types */
export var VerificationMethodType;
(function (VerificationMethodType) {
    VerificationMethodType["Undefined"] = "Undefined";
    VerificationMethodType["JsonWebKey"] = "JsonWebKey";
})(VerificationMethodType || (VerificationMethodType = {}));
export const VerificationMethodTypeSchema = z.enum(VerificationMethodType);
export var KeyType;
(function (KeyType) {
    KeyType["EC"] = "EC";
    KeyType["RSA"] = "RSA";
    KeyType["oct"] = "oct";
    KeyType["OKP"] = "OKP";
})(KeyType || (KeyType = {}));
export const KeyTypeSchema = z.enum(KeyType);
export var CurveType;
(function (CurveType) {
    CurveType["Ed25519"] = "Ed25519";
    CurveType["X25519"] = "X25519";
    CurveType["Jubjub"] = "Jubjub";
    CurveType["P256"] = "P-256";
    CurveType["Secp256k1"] = "secp256k1";
})(CurveType || (CurveType = {}));
export const CurveTypeSchema = z.enum(CurveType);
// Base64url-encoded string (no padding). Conservative charset check only.
const Base64UrlStringSchema = z.string().check(z.regex(/^[A-Za-z0-9_-]*$/), z.refine((value) => value.length % 4 !== 1, "Invalid base64url length"));
const isBase64UrlBytes32 = (value) => {
    try {
        decodeBase64UrlBytes32(value);
        return true;
    }
    catch {
        return false;
    }
};
export const PublicKeyJwkSchema = z
    .looseObject({
    kty: KeyTypeSchema,
    crv: CurveTypeSchema,
    x: Base64UrlStringSchema,
    y: z.optional(Base64UrlStringSchema),
})
    .check(z.refine((value) => value.kty !== KeyType.OKP ||
    value.crv === CurveType.Ed25519 ||
    value.crv === CurveType.X25519, "OKP keys must use the Ed25519 or X25519 curve"))
    .check(z.refine((value) => value.kty !== KeyType.EC ||
    value.crv === CurveType.Jubjub ||
    value.crv === CurveType.P256 ||
    value.crv === CurveType.Secp256k1, "EC keys must use Jubjub, P-256, or secp256k1 curve"))
    .check(z.refine((value) => value.kty !== KeyType.OKP || value.y === undefined, "OKP keys must not include a y coordinate"))
    .check(z.refine((value) => value.kty === KeyType.OKP || value.y !== undefined, "Non-OKP keys must include a y coordinate"))
    .check(z.refine((value) => isBase64UrlBytes32(value.x), "publicKeyJwk.x must be canonical base64url for exactly 32 bytes"))
    .check(z.refine((value) => value.y === undefined || isBase64UrlBytes32(value.y), "publicKeyJwk.y must be canonical base64url for exactly 32 bytes"));
/** Verification Method */
export const VerificationMethodSchema = z.object({
    id: DIDKeyIDSchema,
    type: VerificationMethodTypeSchema,
    controller: DIDStringSchema,
    publicKeyJwk: PublicKeyJwkSchema,
});
/** Verification Method Relation */
export var VerificationMethodRelationType;
(function (VerificationMethodRelationType) {
    VerificationMethodRelationType["Undefined"] = "Undefined";
    VerificationMethodRelationType["Authentication"] = "Authentication";
    VerificationMethodRelationType["AssertionMethod"] = "AssertionMethod";
    VerificationMethodRelationType["KeyAgreement"] = "KeyAgreement";
    VerificationMethodRelationType["CapabilityInvocation"] = "CapabilityInvocation";
    VerificationMethodRelationType["CapabilityDelegation"] = "CapabilityDelegation";
})(VerificationMethodRelationType || (VerificationMethodRelationType = {}));
export const VerificationMethodRelationTypeSchema = z.enum(VerificationMethodRelationType);
/** Service Endpoint */
const isUri = (value) => {
    try {
        new URL(value);
        return true;
    }
    catch {
        return false;
    }
};
export const URIStringSchema = z
    .string()
    .check(z.refine(isUri, "Invalid URI (must conform to RFC3986)"));
export const ServiceEndpointObjectSchema = z.record(z.string(), z.unknown());
export const ServiceEndpointArrayEntrySchema = z.union([
    URIStringSchema,
    ServiceEndpointObjectSchema,
]);
export const ServiceEndpointSchema = z.union([
    URIStringSchema,
    ServiceEndpointObjectSchema,
    z.array(ServiceEndpointArrayEntrySchema),
]);
const isDefaultPort = (protocol, port) => (protocol === "http:" && port === "80") ||
    (protocol === "https:" && port === "443") ||
    (protocol === "ws:" && port === "80") ||
    (protocol === "wss:" && port === "443");
const normalizeUriString = (value) => {
    const schemeMatch = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    if (!schemeMatch)
        return value;
    const scheme = schemeMatch[1].toLowerCase();
    if (!["http", "https", "ws", "wss"].includes(scheme))
        return value;
    try {
        const url = new URL(value);
        const protocol = url.protocol.toLowerCase();
        const username = url.username;
        const password = url.password;
        const auth = username
            ? `${username}${password ? `:${password}` : ""}@`
            : "";
        const hostname = url.hostname.toLowerCase();
        const port = url.port && !isDefaultPort(protocol, url.port) ? `:${url.port}` : "";
        let pathname = url.pathname;
        const hadTrailingSlash = value.endsWith("/");
        if (!hadTrailingSlash && pathname === "/")
            pathname = "";
        const search = url.search;
        const hash = url.hash;
        return `${protocol}//${auth}${hostname}${port}${pathname}${search}${hash}`;
    }
    catch {
        return value;
    }
};
const normalizeEndpointValue = (value) => {
    if (typeof value === "string")
        return normalizeUriString(value);
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeEndpointValue(entry));
    }
    if (value && typeof value === "object") {
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            result[key] = normalizeEndpointValue(entry);
        }
        return result;
    }
    return value;
};
export function normalizeServiceEndpoint(endpoint) {
    if (typeof endpoint === "string")
        return normalizeUriString(endpoint);
    if (Array.isArray(endpoint))
        return endpoint.map((entry) => normalizeEndpointValue(entry));
    return normalizeEndpointValue(endpoint);
}
export const ServiceIdSchema = z.union([DIDURLSchema, RelativeURLSchema]);
/** Service */
export const ServiceSchema = z.object({
    id: ServiceIdSchema,
    type: z.union([z.string(), z.array(z.string())]),
    serviceEndpoint: ServiceEndpointSchema,
});
/** DID Document (W3C DID Core 1.0 compliant - generic) */
export const DIDDocumentSchema = z.looseObject({
    "@context": z.union([z.string(), z.array(z.string())]),
    id: DIDStringSchema,
    alsoKnownAs: z.nullish(z.array(URIStringSchema)),
    controller: z.nullish(z.union([DIDStringSchema, z.array(DIDStringSchema)])),
    verificationMethod: z.nullish(z.array(VerificationMethodSchema)),
    authentication: z.nullish(z
        .array(DIDKeyIDSchema)
        .check(z.minLength(1, "authentication must contain at least one entry"))),
    assertionMethod: z.nullish(z
        .array(DIDKeyIDSchema)
        .check(z.minLength(1, "assertionMethod must contain at least one entry"))),
    keyAgreement: z.nullish(z
        .array(DIDKeyIDSchema)
        .check(z.minLength(1, "keyAgreement must contain at least one entry"))),
    capabilityInvocation: z.nullish(z
        .array(DIDKeyIDSchema)
        .check(z.minLength(1, "capabilityInvocation must contain at least one entry"))),
    capabilityDelegation: z.nullish(z
        .array(DIDKeyIDSchema)
        .check(z.minLength(1, "capabilityDelegation must contain at least one entry"))),
    service: z.nullish(z.array(ServiceSchema)),
});
function validateDIDDocumentConsistency(doc) {
    const normalizedDoc = doc.service == null
        ? doc
        : {
            ...doc,
            service: doc.service.map((service) => ({
                ...service,
                serviceEndpoint: normalizeServiceEndpoint(service.serviceEndpoint),
            })),
        };
    const issues = [];
    const verificationMethods = normalizedDoc.verificationMethod ?? [];
    const seenVerificationMethodIds = new Map();
    const canonicalizeKeyReference = (value) => {
        if (value.startsWith("did:"))
            return value;
        const fragment = value.startsWith("#") ? value : `#${value}`;
        return `${normalizedDoc.id}${fragment}`;
    };
    verificationMethods.forEach((vm, index) => {
        const canonicalId = canonicalizeKeyReference(vm.id);
        if (seenVerificationMethodIds.has(canonicalId)) {
            issues.push({
                message: "verificationMethod ids must be unique",
                path: ["verificationMethod", index, "id"],
            });
        }
        else {
            seenVerificationMethodIds.set(canonicalId, index);
        }
    });
    const ensureRelationConsistency = (relationName) => {
        const relationValues = normalizedDoc[relationName];
        if (relationValues == null)
            return;
        const seen = new Set();
        relationValues.forEach((value, index) => {
            const canonicalValue = canonicalizeKeyReference(value);
            if (seen.has(canonicalValue)) {
                issues.push({
                    message: `${relationName} must not contain duplicate entries`,
                    path: [relationName, index],
                });
                return;
            }
            seen.add(canonicalValue);
            if (!seenVerificationMethodIds.has(canonicalValue)) {
                issues.push({
                    message: `${relationName} references a verificationMethod id that does not exist`,
                    path: [relationName, index],
                });
            }
        });
    };
    ensureRelationConsistency("authentication");
    ensureRelationConsistency("assertionMethod");
    ensureRelationConsistency("keyAgreement");
    ensureRelationConsistency("capabilityInvocation");
    ensureRelationConsistency("capabilityDelegation");
    const services = normalizedDoc.service ?? [];
    const seenServiceIds = new Set();
    services.forEach((service, index) => {
        if (seenServiceIds.has(service.id)) {
            issues.push({
                message: "service ids must be unique",
                path: ["service", index, "id"],
            });
        }
        else {
            seenServiceIds.add(service.id);
        }
        const endpoints = Array.isArray(service.serviceEndpoint)
            ? service.serviceEndpoint
            : [service.serviceEndpoint];
        const seenEndpoints = new Set();
        endpoints.forEach((endpoint, endpointIndex) => {
            const key = typeof endpoint === "string" ? endpoint : JSON.stringify(endpoint);
            if (seenEndpoints.has(key)) {
                issues.push({
                    message: "serviceEndpoint values must be unique",
                    path: ["service", index, "serviceEndpoint", endpointIndex],
                });
            }
            else {
                seenEndpoints.add(key);
            }
        });
    });
    if (issues.length > 0) {
        const message = issues
            .map((issue) => issue.path && issue.path.length > 0
            ? `${issue.message} at ${issue.path.join(".")}`
            : issue.message)
            .join("; ");
        const error = new Error(message);
        error.issues = issues;
        throw error;
    }
    return normalizedDoc;
}
/** DID Document Metadata */
const DateTimeStringSchema = z.iso.datetime({ offset: true, precision: 0 });
export const DIDDocumentMetadataSchema = z.looseObject({
    created: z.nullish(DateTimeStringSchema),
    updated: z.nullish(DateTimeStringSchema),
    deactivated: z.nullish(z.boolean()),
    versionId: z.nullish(z.string()),
    nextUpdate: z.nullish(z.string()),
    nextVersionId: z.nullish(z.string()),
    equivalentId: z.nullish(z.array(z.string())),
    canonicalId: z.nullish(z.string()),
});
export const DIDDocumentRepresentationMediaTypesSchema = z.enum([
    "application/did+ld+json",
    "application/did+json",
]);
export const DIDResolutionEnvelopeMediaTypesSchema = z.enum([
    "application/ld+json",
    "application/json",
]);
export const KnownDIDMediaTypesSchema = z.enum([
    "application/did+ld+json",
    "application/did+json",
    "application/ld+json",
    "application/json",
]);
export const KnownDIDResolutionErrorCodeSchema = z.enum([
    "invalidDid",
    "internalError",
    "invalidPublicKey",
    "invalidPublicKeyLength",
    "invalidPublicKeyType",
    "methodNotSupported",
    "notAllowedCertificate",
    "notAllowedGlobalDuplicateKey",
    "notAllowedKeyType",
    "notAllowedLocalDerivedKey",
    "notAllowedLocalDuplicateKey",
    "notAllowedMethod",
    "notAllowedVerificationMethodType",
    "notFound",
    "representationNotSupported",
    "unsupportedPublicKeyType",
]);
export const DIDResolutionErrorCodeSchema = z.string().check(z.regex(/^[A-Za-z][A-Za-z0-9]*$/, {
    message: "DID resolution error must match [A-Za-z][A-Za-z0-9]*",
}));
/** DID Resolution Result */
export const DIDResolutionResultSchema = z.looseObject({
    "@context": z.nullish(z.union([z.string(), z.array(z.string())])),
    didDocument: z.nullish(DIDDocumentSchema),
    didDocumentMetadata: DIDDocumentMetadataSchema,
    didResolutionMetadata: z.looseObject({
        contentType: z.nullish(DIDDocumentRepresentationMediaTypesSchema),
        error: z.nullish(DIDResolutionErrorCodeSchema),
    }),
});
/** Parsing Helpers */
export const parseDIDDocument = (input) => validateDIDDocumentConsistency(DIDDocumentSchema.parse(input));
export const parseDIDURL = (input) => DIDURLSchema.parse(input);
export const parseDIDKeyID = (input) => DIDKeyIDSchema.parse(input);
export const parseDID = (input) => DIDStringSchema.parse(input);
export const parseVerificationMethod = (input) => VerificationMethodSchema.parse(input);
export const parseService = (input) => {
    const service = ServiceSchema.parse(input);
    return {
        ...service,
        serviceEndpoint: normalizeServiceEndpoint(service.serviceEndpoint),
    };
};
export const parseDIDResolutionResult = (input) => DIDResolutionResultSchema.parse(input);
export const parseVerificationMethodType = (input) => VerificationMethodTypeSchema.parse(input);
export const parseVerificationMethodRelation = (input) => VerificationMethodRelationTypeSchema.parse(input);
/** Creation Helpers */
export function createVerificationMethod(params) {
    return VerificationMethodSchema.parse(params);
}
export function createService(params) {
    const service = ServiceSchema.parse(params);
    return {
        ...service,
        serviceEndpoint: normalizeServiceEndpoint(service.serviceEndpoint),
    };
}
export function createDIDDocument(params) {
    const doc = DIDDocumentSchema.parse({
        "@context": params.context ?? "https://www.w3.org/ns/did/v1",
        id: params.id,
        alsoKnownAs: params.alsoKnownAs ?? null,
        controller: params.controller ?? null,
        verificationMethod: params.verificationMethod ?? null,
        authentication: params.authentication ?? null,
        assertionMethod: params.assertionMethod ?? null,
        keyAgreement: params.keyAgreement ?? null,
        capabilityInvocation: params.capabilityInvocation ?? null,
        capabilityDelegation: params.capabilityDelegation ?? null,
        service: params.service ?? null,
    });
    return validateDIDDocumentConsistency(doc);
}
//# sourceMappingURL=did-document.js.map