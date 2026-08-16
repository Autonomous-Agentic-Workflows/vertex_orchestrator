export interface KeepNote {
  name?: string;
  title: string;
  bodyText: string;
  createTime?: string;
}

export async function createGoogleKeepNote(accessToken: string, title: string, textContent: string) {
  // Google Keep API v1 endpoint
  const url = 'https://keep.googleapis.com/v1/notes';
  const body = {
    title,
    body: {
      text: {
        text: textContent
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Fallback if Keep REST API requires specific GCP project activation or enterprise scopes
    throw new Error(err?.error?.message || `Google Keep API error (${res.status}): ${res.statusText}`);
  }

  return await res.json();
}

export async function listKeepNotes(accessToken: string) {
  const url = 'https://keep.googleapis.com/v1/notes';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to list Keep notes: ${res.statusText}`);
  }
  const data = await res.json();
  return data.notes || [];
}
