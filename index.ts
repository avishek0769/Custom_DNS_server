import dgram from 'node:dgram';
import dnsPacket, { type Answer } from 'dns-packet';

const server = dgram.createSocket('udp4');

const db: Record<string, { type: "A" | "CNAME"; data: string }> = {
    "videotubes.app": {
        type: "A",
        data: "20.193.133.136"
    },
    "www.videotubes.app": {
        type: "CNAME",
        data: "videotubes.app"
    },
    "videocall.studio": {
        type: "A",
        data: "20.193.133.136"
    },
    "www.videocall.studio": {
        type: "CNAME",
        data: "videocall.studio"
    },
    "chatgpt.com": {
        type: "A",
        data: "172.64.155.209"
    },
    "google.com": {
        type: "A",
        data: "142.250.206.78"
    },
}
// Command to forward outgoing UDP reqs to destination port 53 to local 2053 -
// sudo iptables -t nat -A OUTPUT -p udp --dport 53 -j REDIRECT --to-ports 2053

// Command to stop port forwarding -
// sudo iptables -t nat -D OUTPUT -p udp --dport 53 -j REDIRECT --to-ports 2053

server.on('message', (msg, rinfo) => {
    try {
        const query: dnsPacket.DecodedPacket = dnsPacket.decode(msg)
        const questionName = query.questions?.[0].name;
        const dbResponse = questionName ? db[questionName as keyof typeof db] : undefined;
        let response;
    
        if(dbResponse && questionName) {
            console.log("Query --> ", query.questions?.[0].name)
            let answers: Answer[] = []

            if(dbResponse.type == "CNAME") {
                answers.push({
                    type: dbResponse.type as "A" | "CNAME",
                    class: "IN",
                    name: questionName,
                    data: dbResponse.data
                })
                
                const dbResponseForCname = db[dbResponse.data];
                
                answers.push({
                    type: dbResponseForCname.type as "A" | "CNAME",
                    class: "IN",
                    name: dbResponse.data,
                    data: dbResponseForCname.data
                })
            }
            else if(dbResponse.type == "A") {
                answers.push({
                    type: dbResponse.type as "A" | "CNAME",
                    class: "IN",
                    name: questionName,
                    data: dbResponse.data
                })
            }

            response = dnsPacket.encode({
                type: "response",
                id: query.id,
                flags: dnsPacket.AUTHORITATIVE_ANSWER,
                questions: query.questions,
                answers
            })

            server.send(response, rinfo.port, rinfo.address)
            console.log("Answer --> ", query.questions?.[0].name)
        }
    }
    catch (error) {
        console.log("Error --> ", error)
    }
});

server.on("listening", () => {
    console.log("UDP - DNS Server running on 2053...")
})

server.on('error', (err) => {
    console.error(`Server error:\n${err.stack}`);
    server.close();
});

server.bind(2053);
