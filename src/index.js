'use strict'

const pull = require('pull-stream')
const pb = require('pull-protocol-buffers')

const proto = require('./proto')
const multicodec = '/libp2p/analytics/1.0.0'

function statsToJson (statsObj) {
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

const typeNames = {
  1: 'ALL',
  2: 'PEER',
  3: 'PROTO',
  4: 'TRANSPORT'
}

class Analytics {
  constructor () {
    this.libp2p = null
    this.stats = null

    this.statsResolvers = {
      PEER: (peers) => {
        peers = peers || this.stats.peers()
        return peers.map((peerId) => {
          const rawPeerStats = this.stats.forPeer(peerId)
          const peerStats = statsToJson(rawPeerStats)
          return peerStats
        })
      },
      PROTO: (proto) => {
        if (proto) {
          return this.stats.forProtocol(proto)
        }

        const protocolStats = {}
        // some protocols are non-strings
        this.stats.protocols()
          .filter(protocolName => typeof protocolName === 'string')
          .forEach((protocolName) => {
            const rawProtocolStats = this.stats.forProtocol(protocolName)
            protocolStats[protocolName] = statsToJson(rawProtocolStats)
          })
      },
      TRANSPORT: (transport) => {
        if (transport) {
          return this.stats.forTransport(transport)
        }

        const transportStats = {}
        this.stats.transports().forEach((transportName) => {
          const rawTransportStats = this.stats.forTransport(transportName)
          transportStats[transportName] = statsToJson(rawTransportStats)
        })
      }
    }
  }

  mount (libp2p) {
    this.libp2p = libp2p
    this.stats = libp2p.stats
  }

  start () {
    this.libp2p.handleProto(multicodec, (_, conn) => {
      pull(
        conn,
        pb.decode(proto),
        pull.asyncMap((msg, cb) => {
          let stats = null
          if (!msg.query || msg.query.find((q) => q.type === proto.Type.ALL)) {
            stats = Object.keys(proto.Type).map((type) => {
              return this.statsResolvers[type].apply(this)
            })
          } else {
            stats = msg.query
              .map((q) => {
                return {
                  name: typeNames[q.type],
                  query: q.query
                }
              }).map((q) => {
                return this.statsResolvers[q.name].call(this, q.query)
              })
          }

          cb(null, {
            status: proto.Status.OK,
            response: stats
          })
        }),
        pb.encode(proto),
        conn
      )
    })
  }

  getPeers (peers, callback) {
    this._sendRpcCall(proto.Type.PEER, peers, callback)
  }

  getTransports (transports, callback) {
    this._sendRpcCall(proto.Type.TRANSPORT, transports, callback)
  }

  getProtos (protos, callback) {
    this._sendRpcCall(proto.Type.PROTO, protos, callback)
  }

  getAll (callback) {
    this._sendRpcCall(proto.Type.ALL, null, callback)
  }

  _sendRpcCall (type, query, callback) {
    this.libp2p.dialProto(multicodec, (_, conn) => {
      pull(
        pull.values([{ type, query }]),
        pb.encode(proto),
        conn,
        pull.collect((err, data) => {
          if (err) {
            return callback(err)
          }
          callback(null, data[0])
        })
      )
    })
  }

  stop () {
    this.libp2p.unhandle(multicodec)
  }
}

module.expose = Analytics
