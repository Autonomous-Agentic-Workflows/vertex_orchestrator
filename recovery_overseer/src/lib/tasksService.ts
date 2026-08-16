export interface TaskItem {
  id?: string;
  title: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
}

export async function listTaskLists(accessToken: string) {
  const url = 'https://tasks.googleapis.com/tasks/v1/users/@default/lists';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to list Google Tasks lists: ${res.statusText}`);
  }
  const data = await res.json();
  return data.items || [];
}

export async function listTasks(accessToken: string, tasklistId: string = '@default') {
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to list tasks: ${res.statusText}`);
  }
  const data = await res.json();
  return (data.items as TaskItem[]) || [];
}

export async function createGoogleTask(accessToken: string, task: TaskItem, tasklistId: string = '@default') {
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(task)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create task: ${res.statusText}`);
  }
  return await res.json();
}
