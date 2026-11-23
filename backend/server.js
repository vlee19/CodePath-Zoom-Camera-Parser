const express = require('express');
const dotenv = require('dotenv');
const crypto = require('crypto');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3001;

const FRONTEND_URL = 'http://localhost:5173';

app.use(cors({
    origin: FRONTEND_URL,
}));

app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST'],
    },
});

const claims = new Map();

function getMeetingRoom(meetingNumber) {
    return `meeting:${meetingNumber}`;
}

function getClaimKey(meetingNumber, participantId) {
    return `${meetingNumber}:${participantId}`;
}

function getMeetingClaims(meetingNumber) {
    const result = {};

    for (const [key, claim] of claims.entries()) {
        if (key.startsWith(`${meetingNumber}:`)) {
            result[claim.participantId] = claim;
        }
    }

    return result;
}

app.get('/', (req, res) => {
    res.send('Zoom Cam-Parsing backend is running');
});

app.post('/api/signature', (req, res) => {
    const { meetingNumber } = req.body;

    if (!meetingNumber || !/^\d+$/.test(String(meetingNumber))) {
        return res.status(400).json({
            error: 'A valid meeting number is required.',
        });
    }

    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({
            error: 'Zoom credentials are not configured.',
        });
    }

    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 2 * 60 * 60;

    const header = {
        alg: 'HS256',
        typ: 'JWT',
    };

    const payload = {
        appKey: clientId,
        mn: String(meetingNumber),
        role: 0,
        iat,
        exp,
        tokenExp: exp,
    };

    const base64url = (value) => 
        Buffer.from(value).toString('base64url');

    const headerEncoded = base64url(JSON.stringify(header));
    const payloadEncoded = base64url(JSON.stringify(payload));
    const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

    const signatureEncoded = crypto
        .createHmac('sha256', clientSecret)
        .update(unsignedToken)
        .digest('base64url');

    const signature = `${unsignedToken}.${signatureEncoded}`;

    res.json({ signature });
});

io.on('connection', (socket) => {
    console.log('Moderator connected:', socket.id);

    socket.on('join-meeting', (data, callback) => {
        const meetingNumber = String(data?.meetingNumber ?? '');
        const moderatorId = String(data?.moderatorId ?? '');
        const moderatorName = String(data?.moderatorName ?? '').trim();

        if (
            !/^\d+$/.test(meetingNumber) ||
            !moderatorId ||
            !moderatorName
        ) {
            callback?.({
                ok:false,
                error: 'Meeting and moderator details are required.'
            });
            return;
        }

        socket.join(getMeetingRoom(meetingNumber));

        socket.data.meetingNumber = meetingNumber;
        socket.data.moderatorId = moderatorId;
        socket.data.moderatorName = moderatorName;

        callback?.({
            ok: true,
            claims: getMeetingClaims(meetingNumber),
        });
    });

    socket.on('claim-participant', (data, callback) => {
        const meetingNumber = socket.data.meetingNumber;
        const participantId = String(data?.participantId ?? '');

        if (!meetingNumber || !participantId) {
            callback?.({
                ok: false,
                error: 'Join a meeting and select a participant first.',
            });
            return;
        }

        const key = getClaimKey(meetingNumber, participantId);
        const existingClaim = claims.get(key);

        if (existingClaim) {
            callback?.({
                ok: false,
                error: `Already claimed by ${existingClaim.moderatorName}.`,
            });
            return;
        }

        const claim = {
            participantId,
            moderatorId: socket.data.moderatorId,
            moderatorName: socket.data.moderatorName,
            claimedAt: new Date().toISOString(),
        };

        claims.set(key, claim);

        io.to(getMettingRoom(meetingNumber)).emit(
            'claims-updated',
            getMeetingClaims(meetingNumber)
        );

        callback?.({
            ok: true,
            claim,
        });
    });

    socket.on('release-participant', (data, callback) => {
        const meetingNumber = socket.data.meetingNumber;
        const participantId = String(data?.participantId ?? '');

        if (!meetingNumber || !participantId) {
            callback?.({
                ok: false,
                error: 'Join a meeting and select a participant first.'
            });
            return;
        }

        const key = getClaimKey(meetingNumber, participantId);
        const existingClaim = claims.get(key);

        if (!existingClaim) {
            callback?.({
                ok: false,
                error: 'This participant is not currently claimed.',
            });
            return;
        }

        if (existingClaim.moderatorId !== socket.data.moderatorId) {
            callback?.({
                ok: false,
                error: 'Only the moderator who claimed this participant can release them.',
            });
            return;
        }

        claims.delete(key);

        io.to(getMeetingRoom(meetingNumber)).emit(
            'claims-updated',
            getMeetingClaims(meetingNumber)
        );

        callback?.({ ok: true });
    });

    socket.on('disconnect', () => {
        console.log('Moderator disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`)
});