var udp = require('datagram-stream');

var stream = udp({
    address     : '0.0.0.0'   //address to bind to
    , unicast   : '127.0.0.1' //unicast ip address to send to
    , port      : 5554        //udp port to send to
    , bindingPort : 5555      //udp port to listen on. Default: port
    , reuseAddr : true        //boolean: allow multiple processes to bind to the
                              //         same address and port. Default: true
 });

//pipe whatever is received to stdout
stream.pipe(process.stdout);

//pipe whatever is received on stdin over udp
process.stdin.pipe(stream);
