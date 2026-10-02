import {
  instagramAccessToken,
  instagramConfigured,
  messengerConfigured,
  messengerPageAccessToken,
  metaGraphApiBaseUrl,
  metaGraphApiVersion,
} from "./config";
import type { SocialChannel } from "./normalize";

export type SendSocialTextMessageParams = {
  channel: SocialChannel;
  recipientId: string;
  text: string;
};

export type SendSocialTextMessageResult = {
  providerMessageId: string;
  recipientId: string;
  isMock: boolean;
};

export class SocialProviderError extends Error {
  readonly code: string;
  readonly httpStatus?: number;

  constructor(message: string, code: string, httpStatus?: number) {
    super(message);
    this.name = "SocialProviderError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export async function sendSocialTextMessage(
  params: SendSocialTextMessageParams,
): Promise<SendSocialTextMessageResult> {
  const { channel, recipientId, text } = params;

  const isConfigured = channel === "INSTAGRAM" ? instagramConfigured : messengerConfigured;
  const token = channel === "INSTAGRAM" ? instagramAccessToken : messengerPageAccessToken;

  // Mock mode for development, smoke tests, and deployments without Meta credentials
  if (!isConfigured || !token) {
    const mockId = `mock_meta_${channel.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      providerMessageId: mockId,
      recipientId,
      isMock: true,
    };
  }

  // Real Meta Graph API call
  const endpoint = `${metaGraphApiBaseUrl}/${metaGraphApiVersion}/me/messages`;

  const payload: Record<string, unknown> = {
    recipient: { id: recipientId },
    message: { text },
  };
  if (channel === "MESSENGER") {
    payload.messaging_type = "RESPONSE";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const json = (await response.json().catch(() => ({}))) as {
      message_id?: string;
      recipient_id?: string;
      error?: {
        message?: string;
        code?: number;
        error_subcode?: number;
      };
    };

    if (!response.ok || json.error) {
      const errMsg = json.error?.message || `Meta API returned HTTP ${response.status}`;
      const errCode = json.error?.code ? `META_ERROR_${json.error.code}` : "META_API_ERROR";
      throw new SocialProviderError(errMsg, errCode, response.status);
    }

    const providerMessageId = json.message_id || `meta_msg_${Date.now()}`;
    return {
      providerMessageId,
      recipientId: json.recipient_id || recipientId,
      isMock: false,
    };
  } catch (error) {
    if (error instanceof SocialProviderError) throw error;
    const isTimeout = error instanceof Error && error.name === "AbortError";
    throw new SocialProviderError(
      isTimeout ? "Meta API request timed out" : (error instanceof Error ? error.message : "Meta API error"),
      isTimeout ? "META_TIMEOUT" : "META_NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
  }
}
