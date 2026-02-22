import dgram from 'node:dgram';

const server = dgram.createSocket('udp4');

server.on('error', (err) => {
    console.error(`Server error:\n${err.stack}`);
    server.close();
});

server.on('message', (msg, rinfo) => {
    console.log(`Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
});

server.on("listening", () => {
    console.log("UDP - DNS Server running on 2053...")
})

server.bind(2053);
