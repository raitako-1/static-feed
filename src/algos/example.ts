import {
  type QueryParams,
  type OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { type AppContext } from '../util/config'

// max 15 chars
export const shortname = 'example'

export const handler = async (ctx: AppContext, params: QueryParams): Promise<AlgoOutput> => {
  const posts: {post: string}[] = [
    {post: 'at://did:plc:ragtjsm2j2vknwkz3zp4oxrd/app.bsky.feed.post/3jhnzcfawac27'},
  ]

  const start = parseInt(params.cursor ?? '0', 10)
  const feed = posts.slice(start, start + params.limit)
  let cursor: string | undefined
  const last = feed.at(-1)
  if (last) {
    cursor = (posts.indexOf(last) + 1).toString(10)
  }

  return {
    cursor,
    feed,
  }
}
