console.log('Starting...')

import { closeSignal } from './cmds/stop'
import FeedGenerator from './server'
import { setupCmd } from './util/cmd'
import { env } from './util/config'
import { createLogger } from './util/logger'

const run = async () => {
  const logger = createLogger(['Runner'])
  logger.info(`Running ${process.env.npm_package_name} ${process.env.npm_package_version} (${env.NODE_ENV})`)
  logger.info(`System Info: Node.js ${process.version} / ${process.platform} ${process.arch}`)
  logger.debug('DebugMode is enabled.')

  const server = FeedGenerator.create()

  await server.start()

  setupCmd(server, createLogger(['Runner', 'Commander']))

  process.on('SIGHUP', async () => await closeSignal(server, logger))
  process.on('SIGINT', async () => await closeSignal(server, logger))
  process.on('SIGTERM', async () => await closeSignal(server, logger))

  logger.info(`🤖 running feed generator at http://${env.FEEDGEN_LISTENHOST}:${env.FEEDGEN_PORT}`)
}

run()
