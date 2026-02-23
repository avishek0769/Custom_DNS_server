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
}

server.on('message', (msg, rinfo) => {
    try {
        const query: dnsPacket.DecodedPacket = dnsPacket.decode(msg)
        const questionName = query.questions?.[0].name;
        const dbResponse = questionName ? db[questionName as keyof typeof db] : undefined;
        let response;
    
        if(dbResponse && questionName) {
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
        }
        else throw new Error("dbResponse or questionName not available")
    
        server.send(response, rinfo.port, rinfo.address)
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
