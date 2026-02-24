"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dgram = require("node:dgram");
var dnsPacket = require("dns-packet");
var server = dgram.createSocket('udp4');
var zones = [
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
var getCname_Record = function (record, questionName) {
    return {
        type: record.type,
        class: "IN",
        name: questionName,
        data: record.data
    };
};
var getA_Record = function (record, questionName) {
    return {
        type: record.type,
        class: "IN",
        name: questionName,
        data: record.data,
    };
};
function getSOA_Record(zone) {
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
function getNS_Record(zone) {
    return {
        type: "NS",
        name: zone.origin,
        class: "IN",
        data: "ns.avishekadhikary.tech"
    };
}
server.on('message', function (msg, rinfo) {
    var _a;
    try {
        var query = dnsPacket.decode(msg);
        var question_1 = (_a = query.questions) === null || _a === void 0 ? void 0 : _a[0];
        var zone = question_1 && zones.find(function (z) { return question_1.name.endsWith(z.origin); });
        var response = void 0;
        if (zone && question_1) {
            var record = zone.records[question_1.name];
            console.log("Question --> ", query.questions);
            var answers = [];
            var authorities = [];
            if (record && question_1.type == "CNAME" && record.type == question_1.type) {
                answers.push(getCname_Record(record, question_1.name));
                var recordForA = zone.records[record.data];
                answers.push(getA_Record(recordForA, record.data));
            }
            else if (record && question_1.type == "A" && record.type == question_1.type) {
                answers.push(getA_Record(record, question_1.name));
            }
            else if (record && question_1.type == "SOA" && record.type == question_1.type) {
                answers.push(getSOA_Record(zone));
            }
            else if (record && question_1.type == "NS" && record.type == question_1.type) {
                answers.push(getNS_Record(zone));
            }
            // If domain exists but record type not supported
            else if (question_1.name.endsWith(zone.origin)) {
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
                authorities: authorities,
                answers: answers,
            });
            server.send(response, rinfo.port, rinfo.address);
            console.log("Answer --> ", answers);
        }
    }
    catch (error) {
        console.log("Error --> ", error);
    }
});
server.on("listening", function () {
    console.log("UDP - DNS Server running on 2053...");
});
server.on('error', function (err) {
    console.error("Server error:\n".concat(err.stack));
    server.close();
});
server.bind(2053, "0.0.0.0");
