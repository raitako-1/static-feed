import events from 'events'
import express from 'express'
import http from 'http'
import { IdResolver } from '@atproto/identity'
import { createServer } from './lexicon'
import describeGenerator from './methods/describe-generator'
import feedGeneration from './methods/feed-generation'
import { type AppContext, env } from './util/config'
import { createLogger } from './util/logger'
import wellKnown from './well-known'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public ctx: AppContext

  constructor(
    app: express.Application,
    ctx: AppContext
  ) {
    this.app = app
    this.ctx = ctx
  }

  static create() {
    const logger = createLogger(['Runner', 'Server'])
    logger.info('Creating server...')

    const app = express()
    const idResolver = new IdResolver()

    const server = createServer({
      validateResponse: true,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    const ctx: AppContext = {
      didResolver: idResolver.did,
      logger,
    }
    feedGeneration(server, ctx)
    describeGenerator(server)
    app.use(server.xrpc.router)
    app.use(wellKnown())
    
    logger.info('Server has been created!')

    return new FeedGenerator(app, ctx)
  }

  async start() {
    this.ctx.logger.info('Starting server...')
    this.server = this.app.listen(env.FEEDGEN_PORT, env.FEEDGEN_LISTENHOST)
    await events.once(this.server, 'listening')
    this.ctx.logger.info('Server started')
  }

  async stop() {
    this.ctx.logger.info('Stopping server...')
    return new Promise<void>((resolve) => {
      this.server?.close(() => {
        this.ctx.logger.info('Server stopped')
        resolve()
      })
    })
  }
}

export default FeedGenerator
