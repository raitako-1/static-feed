import {
  getJetstreamOpsByType,
  isJetstreamCommit,
  JetstreamEvent,
  JetstreamFirehoseSubscriptionBase,
} from './util/jetstream-subscription'
  
export class JetstreamFirehoseSubscription extends JetstreamFirehoseSubscriptionBase {
  async handleEvent(evt: JetstreamEvent) {
    if (!isJetstreamCommit(evt)) return

    const ops = getJetstreamOpsByType(evt)

    if (!ops || !ops.posts?.length) return
    
    const postsToCreate = ops.posts
      .filter((create) => {
        var searchtext = create.commit.record.text
        if (create.commit.record.embed?.images && Array.isArray(create.commit.record.embed.images)) {
          for (const image of create.commit.record.embed.images) {
            searchtext = searchtext + image.alt
          }
        }
        if (typeof create.commit.record.reply === 'undefined') {
          if (typeof create.commit.record.langs !== 'undefined' && create.commit.record.langs.includes('ja')) {
            return true
          }
          if (searchtext.match(/^.*[ぁ-んァ-ヶｱ-ﾝﾞﾟー]+.*$/)) {
            return true
          }
        }
        return false
      })
      .map((create) => {
        // map alf-related posts to a db row
        return {
          uri: `at://${create.did}/${create.commit.collection}/${create.commit.rkey}`,
          cid: create.commit.cid,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToCreate.length > 0) {
      // handle post however here
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}