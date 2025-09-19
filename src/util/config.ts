import dotenv from 'dotenv'
import { cleanEnv, host, num, port, str, testOnly, url } from 'envalid'
import { DidResolver } from '@atproto/identity'
import { type Logger } from './logger'

export type AppContext = {
  didResolver: DidResolver
  logger: Logger
}

dotenv.config()

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly('test'),
    choices: ['development', 'test', 'production'],
  }),
  FEEDGEN_PORT: port({
    devDefault: testOnly(3000),
  }),
  FEEDGEN_LISTENHOST: host({
    devDefault: testOnly('localhost'),
  }),
  FEEDGEN_HOSTNAME: host({
    devDefault: testOnly('example.com'),
  }),
  FEEDGEN_PUBLISHER_DID: str({
    devDefault: testOnly('did:example:alice')
  }),
  FEEDGEN_SERVICE_DID: str({
    default: `did:web:${process.env.FEEDGEN_HOSTNAME ? process.env.FEEDGEN_HOSTNAME : 'example.com'}`,
  }),
})
