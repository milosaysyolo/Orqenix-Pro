export interface ReleasePolicy {
  scopes: Record<string, ScopeConfig>;
  policy: {
    required_gates?: { phase_5_oss?: string[]; phase_5_pro?: string[] };
    forbidden_files_in_tarball?: string[];
    required_files_per_package?: string[];
    required_package_json_fields?: string[];
    semver_rules?: Record<string, unknown>;
    first_publish?: Record<string, unknown>;
  };
}

export interface ScopeConfig {
  license: string;
  access: string;
  provenance?: boolean;
  publishable_from_this_repo: boolean;
}
