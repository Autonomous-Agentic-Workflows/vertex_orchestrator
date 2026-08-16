import firebaseConfig from '../../firebase-applet-config.json';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  content?: string;
}

/**
 * Fetch list of files from Google Drive using OAuth Access Token
 */
export async function listDriveFiles(accessToken: string, query?: string): Promise<DriveFile[]> {
  const q = query ? encodeURIComponent(query) : encodeURIComponent("trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?pageSize=30&fields=files(id,name,mimeType,iconLink,size,modifiedTime,webViewLink)&q=${q}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch Drive files: ${res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Fetch content of a specific text/code file from Google Drive
 */
export async function getDriveFileContent(accessToken: string, fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download file content from Google Drive (${res.status})`);
  }

  return await res.text();
}

/**
 * Save/Export a file to Google Drive
 */
export async function createDriveFile(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<DriveFile> {
  const metadata = {
    name: fileName,
    mimeType: mimeType,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: mimeType }));

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create file in Google Drive`);
  }

  return await res.json();
}

/**
 * Dynamically load Google Picker library and open Google Picker modal
 */
export function openGooglePicker({
  accessToken,
  onFilePicked,
  onCancel,
}: {
  accessToken: string;
  onFilePicked: (file: { id: string; name: string; mimeType: string }) => void;
  onCancel?: () => void;
}) {
  const developerKey = firebaseConfig.apiKey;
  const appId = firebaseConfig.projectId;

  const loadGapi = () => {
    if (window.gapi && window.gapi.picker) {
      buildPicker();
      return;
    }

    if (!document.getElementById('gapi-picker-script')) {
      const script = document.createElement('script');
      script.id = 'gapi-picker-script';
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('picker', { callback: buildPicker });
      };
      script.onerror = () => {
        console.error('Failed to load Google Picker API script.');
        if (onCancel) onCancel();
      };
      document.body.appendChild(script);
    } else {
      window.gapi.load('picker', { callback: buildPicker });
    }
  };

  const buildPicker = () => {
    try {
      if (!window.google || !window.google.picker) {
        console.warn('Google Picker API not loaded yet.');
        return;
      }

      const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
      view.setMimeTypes('text/plain,text/csv,text/x-python,text/x-sql,application/json,text/javascript,application/octet-stream');

      const pickerBuilder = new window.google.picker.PickerBuilder()
        .addView(view)
        .addView(new window.google.picker.DocsUploadView())
        .setOAuthToken(accessToken)
        .setAppId(appId)
        .setOrigin(window.location.origin)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            onFilePicked({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
            });
          } else if (data.action === window.google.picker.Action.CANCEL) {
            if (onCancel) onCancel();
          }
        });

      if (developerKey) {
        pickerBuilder.setDeveloperKey(developerKey);
      }

      const picker = pickerBuilder.build();
      picker.setVisible(true);
    } catch (err) {
      console.error('Error building Google Picker:', err);
    }
  };

  loadGapi();
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}
