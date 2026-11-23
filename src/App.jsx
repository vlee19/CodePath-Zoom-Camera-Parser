import { useEffect, useState } from "react"
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded'
import './App.css'
import { io } from 'socket.io-client'

import ParticipantList from "./components/ParticipantList"
import useParticipants from "./hooks/useParticipants"
import FlaggedParticipants from "./components/FlaggedParticipants"

function App() {
    const [meetingNumber, setMeetingNumber] = useState('')
    const [password, setPassword] = useState('')
    const [userName, setUserName] = useState('')
    const [status, setStatus] = useState('Ready to join')
    const [client, setClient] = useState(null)

    const [socket, setSocket] = useState(null)
    const [claims, setClaims] = useState({})
    
    const { 
        participants, 
        refreshParticipants,
        participantError
    } = useParticipants(client)

    const [participantFlags, setParticipantFlags] = useState({})

    const [moderatorId] = useState(() => {
        let id = localStorage.getItem('moderatorId')

        if (!id) {
            id = crypto.randomUUID()
            localStorage.setItem('moderatorId', id)
        }

        return id
    })
    
    function handleFlagChange(userId, newFlag) {
        setParticipantFlags((currentFlags) => ({
            ...currentFlags,
            [userId]: newFlag
        }))
    }

    useEffect(() => {
        const zoomClient = ZoomMtgEmbedded.createClient()

        async function initializeZoom() {
            try {
                await zoomClient.init({
                    zoomAppRoot: document.getElementById('meetingSDKElement'),
                    language: 'en-US',
                })

                setClient(zoomClient)
            } catch (error) {
                console.error('Zoom initialization failed', error)
                setStatus('Could not initialize Zoom. Check console')
            }
        }

        initializeZoom()
    }, []);

    useEffect(() => {
        const newSocket = io('http://localhost:3001')

        setSocket(newSocket)

        return () => {
            newSocket.disconnect()
        }
    }, [])

    useEffect(() => {
        if (!socket) return

        function handleClaimsUpdated(updatedClaims) {
            setClaims(updatedClaims)
        }

        socket.on('claims-updated', handleClaimsUpdated)

        return () => {
            socket.off('claims-updated', handleClaimsUpdated)
        }
    }, [socket])



    async function joinMeeting(event) {
        event.preventDefault()

        if (!client) {
            setStatus('Zoom is still initializing, try again later.')
            return
        }

        try {
            setStatus('Requesting signature from backend...')

            const response = await fetch('http://localhost:3001/api/signature', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ meetingNumber }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Could not generate signature')
            }

            setStatus('Joining meeting...')

            await client.join({
                signature: data.signature,
                meetingNumber,
                password,
                userName,
            })


            socket.emit('join-meeting', {
                meetingNumber, 
                moderatorId, 
                moderatorName: userName,
            }, (response) => {
                if (response.ok) {
                    setClaims(response.claims || {})
                    console.log('Joined moderator room:', response.claims)
                } else {
                    console.error('Could not join moderator room:', response.error)
                }
            })

            refreshParticipants()
            setStatus('Join request completed.')
        } catch (error) {
            console.error('Could not join meeting:', error)
            setStatus(`Could not join: ${error.message}`)
        }
    }
    
    return (
        <div className="app">
            <header className="dashboard-header">
                <div>
                    <h1>Cam Parsing</h1>
                    <p>Moderator dashboard</p>
                </div>
                <span className="connection-status">
                    {status}
                </span>
            </header>

            <section className="meeting-setup">
                <h2>Join a meeting</h2>
                <form onSubmit={joinMeeting} className="join-form">
                    <div className="form-field">
                        <label htmlFor="meetingNumber">Meeting ID</label>
                        <input
                            id="meetingNumber"
                            value={meetingNumber}
                            onChange={(event) => setMeetingNumber(event.target.value)}
                            required
                            inputMode="numeric"
                            placeholder="Enter meeting ID"
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="password">Meeting password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter passcode"
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="userName">Display name</label>
                        <input
                            id="userName"
                            value={userName}
                            onChange={(event) => setUserName(event.target.value)}
                            required
                            placeholder="Enter display name"
                        />
                    </div>

                    <button type="submit" disabled={!client}>
                        {client ? 'Join Meeting' : 'Loading Zoom...'}
                    </button>
                </form>
            </section>

            {participantError && (
                <p className="error-message" role="alert">
                    {participantError
                }</p>
            )}

            <main className="dashboard-layout">
                <section className="panel meeting-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Live meeting</h2>
                            <p>Monitor participants and camera status.</p>
                        </div>
                    </div>

                    <div 
                        id="meetingSDKElement"
                        className="zoom-container"
                    />

                    <div className="roster-section">
                        <ParticipantList 
                            participants={participants} 
                            participantFlags={participantFlags}
                            onFlagChange={handleFlagChange}
                        />
                    </div>
                </section>

                <section className="panel flags-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Needs attention</h2>
                            <p>Review and update participant flags.</p>
                        </div>

                        <span className="participant-count">
                            {Object.values(participantFlags).filter(Boolean).length}
                        </span>
                    </div>

                    <FlaggedParticipants
                        participants={participants}
                        participantFlags={participantFlags}
                    />
                </section>

                <section className="panel messages-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Moderator messages</h2>
                            <p>
                                Message templates and follow-up tools will go here.
                            </p>
                        </div>
                    </div>

                    <div className="messages-placeholder">
                        <div className="messages-placeholder-icon">
                            ✉
                        </div>
                        <div>
                            <h3>Message center</h3>
                            <p>
                                Reusable message templates, participant selection, and message status tracking.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}

export default App