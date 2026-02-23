import dgram from 'node:dgram';
import dnsPacket, { type Answer } from 'dns-packet';

const server = dgram.createSocket('udp4');

type RecordType = {
    type: "A" | "CNAME" | "SOA" | "NS";
    data: string;
};

type Zone = {
    origin: string;
    admin: string;
    serial: number;
    records: Record<string, RecordType>;
};

const zones: Zone[] = [
    {
        origin: "videotubes.app",
        admin: "admin.videotubes.app",
        serial: 1,
        records: {
            "videotubes.app": {
                type: "A",
                data: "20.193.133.136"
            },
            "www.videotubes.app": {
                type: "CNAME",
                data: "videotubes.app"
            }
        }
    },
    {
        origin: "videocall.studio",
        admin: "admin.videocall.studio",
        serial: 1,
        records: {
            "videocall.studio": {
                type: "A",
                data: "20.193.133.136"
            },
            "www.videocall.studio": {
                type: "CNAME",
                data: "videocall.studio"
            }
        }
    },
    {
        origin: "chatgpt.com",
        admin: "admin.chatgpt.com",
        serial: 1,
        records: {
            "chatgpt.com": {
                type: "A",
                data: "172.64.155.209"
            }
        }
    },
    {
        origin: "google.com",
        admin: "admin.google.com",
        serial: 1,
        records: {
            "google.com": {
                type: "A",
                data: "142.250.206.78"
            }
        }
    }
];

// Command to forward outgoing UDP reqs to destination port 53 to local 2053 -
// sudo iptables -t nat -A OUTPUT -p udp --dport 53 -j REDIRECT --to-ports 2053

// Command to stop port forwarding -
// sudo iptables -t nat -D OUTPUT -p udp --dport 53 -j REDIRECT --to-ports 2053

const getCname_Record = (record: RecordType, questionName: string): Answer => {
    return {
        type: record.type as "A" | "CNAME",
        class: "IN",
        name: questionName,
        data: record.data
    }
}

const getA_Record = (record: RecordType, questionName: string): Answer => {
    return {
        type: record.type as "A" | "CNAME",
        class: "IN",
        name: questionName,
        data: record.data,
    }
}

function getSOA_Record(zone: Zone): Answer {
    return {
        type: "SOA",
        name: zone.origin,
        class: "IN",
        data: {
            mname: "ns.avishekadhikary.tech",
            rname: zone.admin,
            serial: zone.serial,
            refresh: 300,
            retry: 300,
            expire: 1200,
            minimum: 300
        }
    };
}

function getNS_Record(zone: Zone): Answer {
    return {
        type: "NS",
        name: zone.origin,
        class: "IN",
        data: "ns.avishekadhikary.tech"
    };
}

server.on('message', (msg, rinfo) => {
    try {
        const query: dnsPacket.DecodedPacket = dnsPacket.decode(msg)
        const question = query.questions?.[0];
        const zone: Zone | undefined = question && zones.find(z => question.name.endsWith(z.origin))
        let response;

        if (zone && question) {
            const record = zone.records[question.name]
            console.log("Question --> ", query.questions)
            
            let answers: Answer[] = []
            let authorities: Answer[] = []

            if (record && question.type == "CNAME" && record.type == question.type) {
                answers.push(getCname_Record(record, question.name))

                const recordForA = zone.records[record.data]
                answers.push(getA_Record(recordForA, record.data))
            }
            else if (record && question.type == "A" && record.type == question.type) {
                answers.push(getA_Record(record, question.name))
            }
            else if(record && question.type == "SOA" && record.type == question.type) {
                answers.push(getSOA_Record(zone))
            }
            else if(record && question.type == "NS" && record.type == question.type) {
                answers.push(getNS_Record(zone))
            }
            // If domain exists but record type not supported
            else if (question.name.endsWith(zone.origin)) {
                authorities.push(getSOA_Record(zone));
            }
            else {
                response = dnsPacket.encode({
                    type: "response",
                    id: query.id,
                    flags: dnsPacket.AUTHORITATIVE_ANSWER,
                    questions: query.questions,
                    authorities: [getSOA_Record(zone)]
                });

                server.send(response, rinfo.port, rinfo.address);
                return;
            }

            response = dnsPacket.encode({
                type: "response",
                id: query.id,
                flags: dnsPacket.AUTHORITATIVE_ANSWER,
                questions: query.questions,
                authorities,
                answers,
            })

            server.send(response, rinfo.port, rinfo.address)
            console.log("Answer --> ", answers)
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
