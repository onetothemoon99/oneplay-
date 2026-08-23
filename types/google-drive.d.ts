/* ---------------------------------------------------------
   The slices of Google Identity Services and the Google Picker that
   lib/psxDrive.ts actually touches. Both arrive as <script> tags at
   runtime, so there is no package to take types from — and typing
   only the used surface keeps this honest about what we depend on.
--------------------------------------------------------- */

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: string | number;
  error?: string;
  type?: string;
}

interface GoogleTokenClient {
  requestAccessToken(): void;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  prompt?: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: { error?: string; type?: string }) => void;
}

interface GooglePickerDocsView {
  setIncludeFolders(include: boolean): GooglePickerDocsView;
  setSelectFolderEnabled(enabled: boolean): GooglePickerDocsView;
}

interface GooglePickerResponse {
  action: 'picked' | 'cancel' | 'loaded';
  docs?: { id: string; name: string; sizeBytes?: string | number; mimeType?: string }[];
}

interface GooglePickerInstance {
  setVisible(visible: boolean): void;
}

interface GooglePickerBuilder {
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setAppId(appId: string): GooglePickerBuilder;
  enableFeature(feature: unknown): GooglePickerBuilder;
  addView(view: GooglePickerDocsView): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  setCallback(callback: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  build(): GooglePickerInstance;
}

interface GooglePickerNamespace {
  DocsView: new (viewId: unknown) => GooglePickerDocsView;
  PickerBuilder: new () => GooglePickerBuilder;
  ViewId: { DOCS: unknown };
  Feature: { MULTISELECT_ENABLED: unknown };
}

interface GoogleNamespace {
  accounts?: {
    oauth2?: {
      initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient | undefined;
    };
  };
  picker: GooglePickerNamespace;
}

interface Window {
  google: GoogleNamespace;
  gapi: {
    load(name: string, options: { callback: () => void; onerror?: () => void }): void;
  };
}
