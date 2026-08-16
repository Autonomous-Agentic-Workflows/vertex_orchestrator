export interface SlidePresentation {
  presentationId: string;
  title: string;
  slides?: any[];
}

export async function createSparkExecutiveDeck(
  accessToken: string,
  title: string,
  pysparkCode: string,
  metrics: {
    shufflePartitions: number;
    aqeEnabled: boolean;
    estimatedSpeedup: string;
    memorySaved: string;
  }
): Promise<SlidePresentation> {
  // 1. Create Presentation
  const createUrl = 'https://slides.googleapis.com/v4/presentations';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create Google Slides presentation: ${createRes.statusText}`);
  }

  const presentation = await createRes.json();
  const presentationId = presentation.presentationId;

  // 2. Add Slides & Text Content via BatchUpdate
  const batchUrl = `https://slides.googleapis.com/v4/presentations/${presentationId}:batchUpdate`;
  const requests = [
    {
      createSlide: {
        objectId: 'slide_summary',
        insertionIndex: '1',
        slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' }
      }
    },
    {
      insertText: {
        objectId: 'slide_summary',
        text: `Spark Studio Optimization Report\n\n• AQE Status: ${metrics.aqeEnabled ? 'ENABLED' : 'DISABLED'}\n• Shuffle Partitions: ${metrics.shufflePartitions}\n• Estimated Speedup: ${metrics.estimatedSpeedup}\n• Memory Optimization: ${metrics.memorySaved}\n\nPySpark Pipeline Blueprint:\n${pysparkCode.slice(0, 300)}...`
      }
    }
  ];

  await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  }).catch((err) => console.warn('Batch update slides warning:', err));

  return presentation;
}
