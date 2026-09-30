/**
 * Comments the author accepted from Support → Write a message.
 * Add a row in the release that publishes it. `sentOn` is the calendar day
 * from the mail (`Sent:`), not the day of the release.
 */
export type PublishedComment = {
  nickname: string
  body: string
  sentOn: string
}

export const PUBLISHED_COMMENTS: readonly PublishedComment[] = []
