export type CachedAuthStatus = {
  version: 1;
  subscribed: boolean;
  localMirror: boolean;
  testMode: boolean;
  profileId: string;
  accessToken?: string | null;
};

let localIdSequence = 0;

export function createProfileId() {
  // Keep startup independent from platform crypto polyfills. The profile ID is
  // a local storage namespace, not a credential or security boundary.
  localIdSequence = (localIdSequence + 1) % 1_000_000;
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}_${localIdSequence.toString(36)}`;
}

export function localStatus(profileId = createProfileId()): CachedAuthStatus {
  // In development, the web version behaves like a signed-in subscriber
  // to bypass the login screen and enable immediate server interaction.
  const isDevWeb = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  return {
    version: 1,
    subscribed: isDevWeb,
    localMirror: false,
    testMode: isDevWeb,
    profileId: isDevWeb ? "dev-user-id" : profileId,
    accessToken: isDevWeb ? "dev-token-bypass" : null
  };
}
