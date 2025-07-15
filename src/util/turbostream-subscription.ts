import { WebSocketKeepAlive } from './websocket-keepalive'
import { Subscription } from '@atproto/xrpc-server'
import { isObj } from '@atproto/lexicon'
import { ids } from '../lexicon/lexicons'
import { type JetstreamEvent, type JetstreamRecord, isJetstreamCommit, getJetstreamOpsByType} from './jetstream-subscription'
import { handleOperation } from '../subscription'
import { type Database } from '../db'

export class TurbostreamFirehoseSubscription {
  public sub: TurbostreamSubscription<TurbostreamEvent>

  constructor(public db: Database, public service: string, public collection: string = ids.AppBskyFeedPost) {
    this.sub = new TurbostreamSubscription({
      service: service,
      method: 'turbostream',
      getParams: async () => ({
        cursor: await this.getCursor(),
        wantedCollections: collection,
      }),
      validate: (value: unknown) => {
        try {
          return value as JetstreamRecord // TODO validate??
        } catch (err) {
          console.error('repo subscription skipped invalid message', err)
        }
      },
    })
  }

  async run(subscriptionReconnectDelay: number) {
    let i = 0
    try {
      for await (const evt of this.sub) {
        try {
          if (isTurbostreamEvent(evt) && isJetstreamCommit(evt.message)) {
            const ops = getJetstreamOpsByType(evt.message, evt.hydrated_metadata)
            await handleOperation(ops, this.db)
          }
        } catch (err) {
          console.error('repo subscription could not handle message', err)
        }
        i++
        // update stored cursor every 20 events or so
        if (isTurbostreamEvent(evt) && i % 20 === 0) {
          await this.updateCursor(evt.message.time_us)
          i = 0
        }
      }
    } catch (err) {
      console.error('repo subscription errored', err)
      setTimeout(
        () => this.run(subscriptionReconnectDelay),
        subscriptionReconnectDelay,
      )
    }
  }

  async updateCursor(cursor: number) {
    await this.db
      .updateTable('sub_state')
      .set({ cursor })
      .where('service', '=', this.service)
      .execute()
  }

  async getCursor(): Promise<number | undefined> {
    const res = await this.db
      .selectFrom('sub_state')
      .selectAll()
      .where('service', '=', this.service)
      .executeTakeFirst()
    return res?.cursor
  }
}
function isTurbostreamEvent(v: unknown): v is TurbostreamEvent {
  return isObj(v) && 'message' in v
}

export interface TurbostreamEvent {
  at_uri: string
  did: string
  time_us: number | null
  message: JetstreamEvent
  hydrated_metadata: TurbostreamEventHydratedMetadata
}

export interface TurbostreamEventHydratedMetadata {
  user: TurbostreamEventHydratedMetadataUser | null
  mentions: TurbostreamEventHydratedMetadataMentions | null
  parent_post: TurbostreamEventHydratedMetadataParentPost | null
  reply_post: TurbostreamEventHydratedMetadataReplyPost | null
  quote_post: TurbostreamEventHydratedMetadataQuotePost | null
}

export interface TurbostreamEventHydratedMetadataUser {
  did: string
  handle: string
  associated: {
    //chat: null,
    feedgens: number
    labeler: boolean
    lists: number
    starter_packs: number
    //py_type: 'app.bsky.actor.defs#profileAssociated',
    activitySubscription: {
      allowSubscriptions: 'followers' | 'mutuals' | 'none'
    }
  }
  avatar: string
  banner: string
  created_at: string
  description: string
  display_name: string
  followers_count: number
  follows_count: number
  indexed_at: string
  //joined_via_starter_pack: null,
  labels: {
    cts: string
    src: string
    uri: string
    //val: '!no-unauthenticated',
    cid: string
    //exp: null,
    //neg: null,
    //sig: null,
    //ver: null,
    //py_type: 'com.atproto.label.defs#label',
  }[]
  //pinned_post: null,
  posts_count: number
  //verification: null,
  viewer: {
    blocked_by: boolean
    //blocking: null,
    //blocking_by_list: null,
    //followed_by: null,
    //following: null,
    //known_followers: null,
    muted: boolean
    //muted_by_list: null,
    //py_type: 'app.bsky.actor.defs#viewerState',
  }
  //py_type: 'app.bsky.actor.defs#profileViewDetailed',
}

export interface TurbostreamEventHydratedMetadataMentions {
  [k: string]: TurbostreamEventHydratedMetadataUser
}

export interface TurbostreamEventHydratedMetadataParentPost {}

export interface TurbostreamEventHydratedMetadataReplyPost {}

export interface TurbostreamEventHydratedMetadataQuotePost {}

class TurbostreamSubscription<T = unknown> extends Subscription {
  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    const ws = new WebSocketKeepAlive({
      ...this.opts,
      getUrl: async () => {
        const params = (await this.opts.getParams?.()) ?? {}
        const query = encodeQueryParams(params)
        console.log(`Turbostream: ${this.opts.service}/${this.opts.method}?${query}`)
        return `${this.opts.service}/${this.opts.method}?${query}`
      },
    })
    for await (const chunk of ws) {
      try {
        const record = JSON.parse(Buffer.from(chunk).toString())
        yield record
      } catch (e) {
        console.error(e)
      }
    }
  }
}

function encodeQueryParams(obj: Record<string, unknown>): string {
  const params = new URLSearchParams()
  Object.entries(obj).forEach(([key, value]) => {
    const encoded = encodeQueryParam(value)
    if (Array.isArray(encoded)) {
      encoded.forEach((enc) => params.append(key, enc))
    } else {
      params.set(key, encoded)
    }
  })
  return params.toString()
}

// Adapted from xrpc, but without any lex-specific knowledge
function encodeQueryParam(value: unknown): string | string[] {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'undefined') {
    return ''
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    } else if (Array.isArray(value)) {
      return value.flatMap(encodeQueryParam)
    } else if (!value) {
      return ''
    }
  }
  throw new Error(`Cannot encode ${typeof value}s into query params`)
}
