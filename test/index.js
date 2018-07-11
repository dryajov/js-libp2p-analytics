'use strict'

/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const Connection = require('interface-connection').Connection
const pull = require('pull-stream')
const pair = require('pull-pair/duplex')
const parallel = require('async/parallel')

const Analytics = require('../src/index')

const createNode = () => {
  const stream = pair()
  return {
    dialProtocol: (addr, multicodec, callback) => {
      callback(null, new Connection(stream[0]))
    },
    handle: (multicodec, callback) => {
      callback(null, new Connection(stream[1]))
    },
    stats: {}
  }
}

describe('analytics', () => {
  let node
  let analytics
  before((done) => {
    node = createNode()
    analytics = new Analytics()
    analytics.mount(node)
    analytics.start(done)
  })

  after((done) => {
    analytics.stop(done)
  })

  it('getAll', () => {
    analytics.getAll((err, stats) => {
      expect(err).to.not.exist()
      expect(stats).to.exist()
    })
  })
})
