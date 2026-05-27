export type Plan = "pro" | "team" | "enterprise";

export interface LicensePayload {
  customerId: string;
  plan: Plan;
  issuedAt: number;
  expiresAt: number;
  features: string[];
}

export interface License extends LicensePayload {
  signature: string;
}

export type InvalidReason =
  | "signature-invalid"
  | "expired-beyond-grace"
  | "not-yet-valid"
  | "malformed";

export interface LicenseCheckValid {
  valid: true;
  inGrace: boolean;
  graceRemainingMs: number;
}

export interface LicenseCheckInvalid {
  valid: false;
  reason: InvalidReason;
}

export type LicenseCheckResult = LicenseCheckValid | LicenseCheckInvalid;
