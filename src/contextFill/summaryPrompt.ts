/** Pasted into a full conversation. The open chat is the source; this text is not a transcript. */
export function buildContextSummaryPrompt(): string {
  return [
    'This conversation\'s context cache is full. Do not continue the task and do not edit the repo.',
    'Write a handoff I can copy into a new chat and continue from there.',
    'Reply with one fenced markdown block, and nothing else, titled Conversation handoff:',
    '- Goal of this thread',
    '- Decisions already made',
    '- Files and areas that matter',
    '- What is unfinished',
    '- Constraints and what not to redo',
    'The block must stand alone, without this thread\'s history.',
  ].join('\n')
}
