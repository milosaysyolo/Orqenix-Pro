type Plan = "pro" | "team" | "enterprise";
interface LicensePayload {
    customerId: string;
    plan: Plan;
    issuedAt: number;
    expiresAt: number;
    features: string[];
}
interface License extends LicensePayload {
    signature: string;
}
type InvalidReason = "signature-invalid" | "expired-beyond-grace" | "not-yet-valid" | "malformed";
interface LicenseCheckValid {
    valid: true;
    inGrace: boolean;
    graceRemainingMs: number;
}
interface LicenseCheckInvalid {
    valid: false;
    reason: InvalidReason;
}
type LicenseCheckResult = LicenseCheckValid | LicenseCheckInvalid;

declare function canonicalize(payload: LicensePayload): string;
declare function signLicense(payload: LicensePayload, privateKeyPath: string): Promise<License>;

declare const GRACE_PERIOD_MS: number;
interface VerifyOptions {
    publicKeyPath: string;
    now?: number;
    gracePeriodMs?: number;
}
declare function verifyLicense(lic: unknown, opts: VerifyOptions): Promise<LicenseCheckResult>;
declare function hasFeature(lic: License, feature: string): boolean;

declare function loadLicense(path: string): Promise<unknown>;

export { GRACE_PERIOD_MS, type InvalidReason, type License, type LicenseCheckInvalid, type LicenseCheckResult, type LicenseCheckValid, type LicensePayload, type Plan, canonicalize, hasFeature, loadLicense, signLicense, verifyLicense };
