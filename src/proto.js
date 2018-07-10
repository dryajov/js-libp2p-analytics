'use strict'

const protons = require('protons')

module.export = protons(`
message {
  enum Status {
    OK                  = 1;
    E_NO_DATA_FOR_TYPE  = 100;
    E_INTERNAL_ERR      = 101;
  }

  enum Type {
    ALL       = 1;
    PEER      = 2;
    PROTO     = 3;
    TRANSPORT = 4;
  }

  message Query {
    optional Type type    = 1 [default = ALL];
    optional string query = 2;
  }

  optional repeated Query     = 1;
  optional Status   code      = 2;
  optional bytes    response  = 3;
}
`)
