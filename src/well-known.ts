import express from 'express'
import { env } from './util/config'

const makeRouter = () => {
  const router = express.Router()

  router.get('/.well-known/did.json', (_req, res) => {
    if (!env.FEEDGEN_SERVICE_DID.endsWith(env.FEEDGEN_HOSTNAME)) {
      return res.sendStatus(404)
    }
    res.json({
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: env.FEEDGEN_SERVICE_DID,
      service: [
        {
          id: '#bsky_fg',
          type: 'BskyFeedGenerator',
          serviceEndpoint: `https://${env.FEEDGEN_HOSTNAME}`,
        },
      ],
    })
  })

  return router
}
export default makeRouter
