export function isGoogleAuthConfigured(input: {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
}) {
  return Boolean(input.enabled && input.clientId?.trim() && input.clientSecret?.trim());
}
