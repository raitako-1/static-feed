import { FeedGenerator } from '../server'
import { Logger } from '../util/logger'

export default async (server: FeedGenerator, logger: Logger, args: string[]): Promise<void> => {
  await closeSignal(server, logger)
}

export const closeSignal = async (server: FeedGenerator, logger: Logger) => {
  logger.debug('Recieved closeSignal!')
  setTimeout(() => process.exit(1), 10000).unref()
  await server.stop()
  process.stdout.write('\r\x1b[2K')
  process.exit(0)
}
