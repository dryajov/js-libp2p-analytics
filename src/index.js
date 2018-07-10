'use strict'

const pull = require('pull-stream')
const pb = require('pull-protocol-buffers')

const proto = require('./proto')
const multicodec = '/libp2p/analytics/1.0.0'

function libp2pStatsToJson (statsObj) {
  return {
    snapshot: {
      dataReceived: statsObj.snapshot.dataReceived.toString(),
      dataSent: statsObj.snapshot.dataSent.toString()
    },
    movingAverages: {
      dataReceived: {
        '60000': statsObj.movingAverages.dataReceived['60000'].movingAverage(),
        '300000': statsObj.movingAverages.dataReceived['300000'].movingAverage(),
        '900000': statsObj.movingAverages.dataReceived['900000'].movingAverage()
      },
      dataSent: {
        '60000': statsObj.movingAverages.dataSent['60000'].movingAverage(),
        '300000': statsObj.movingAverages.dataSent['300000'].movingAverage(),
        '900000': statsObj.movingAverages.dataSent['900000'].movingAverage()
      }
    }
  }
}

class Analytics {
  constructor () {
    this.libp2p = null
  }

  init (libp2p) {
    this.libp2p = libp2p
  }

  start () {
    this.libp2p.handleProto(multicodec, (_, conn) => {
      let types = []
      pull(
        conn,
        pb.decode(proto),
        pull.asyncMap((msg, cb) => {
          if (!msg.query || msg.query.find((q) => q.type === proto.Type.ALL)) {
            types = 'ALL'
          } else {
            types = msg.query.map((q) => q.type)
          }
        }),
        pb.encode(proto),
        conn
      )

      const stats = {peers: {}}
      // client global
      stats.global = libp2pStatsToJson(this.stats.global)
      // transports
      stats.transports = this.getTransport()
      // protocols
      stats.protocols = this.getProtos()
      // peers
      stats.peers = this.getPeers()
    })
  }

  getGlobal () {
    return libp2pStatsToJson(this.stats.global)
  }

  getTransport (transport) {
    if (transport) {
      return this.stats.forTransport(transport)
    }

    const transportStats = {}
    this.stats.transports().forEach((transportName) => {
      const rawTransportStats = this.stats.forTransport(transportName)
      transportStats[transportName] = libp2pStatsToJson(rawTransportStats)
    })
  }

  getProtos (proto) {
    if (proto) {
      return this.stats.forProtocol(proto)
    }

    const protocolStats = {}
    // some protocols are non-strings
    this.stats.protocols()
      .filter(protocolName => typeof protocolName === 'string')
      .forEach((protocolName) => {
        const rawProtocolStats = this.stats.forProtocol(protocolName)
        protocolStats[protocolName] = libp2pStatsToJson(rawProtocolStats)
      })
  }

  getPeers (peers) {
    peers = peers || this.stats.peers()
    // peers
    return peers.map((peerId) => {
      const rawPeerStats = this.stats.forPeer(peerId)
      const peerStats = libp2pStatsToJson(rawPeerStats)
      return peerStats
    })
  }

  stop () {
    this.libp2p.unhandle(multicodec)
  }
}

module.expose = Analytics
