import { useCallback, useEffect, useState } from 'react'

function useParticipants(client) {
    const [participants, setParticipants] = useState([])
    const [participantError, setParticipantError] = useState('')

    const refreshParticipants = useCallback(() => {
        if (!client) return

        try {
            const currentParticipants = client.getAttendeeslist()

            setParticipants(currentParticipants)
            setParticipantError('')
        } catch (error) {
            console.error('Could not retrieve participants:', error)
            setParticipantError('Could not refresh participants.')
        }
    }, [client])

    
    useEffect(() => {
        if (!client) return

        function handleParticipantChange() {
            refreshParticipants()
        }

        function handleConnectionChange(payload) {
            if (payload.state === 'Closed') {
                setParticipants([])
                setParticipantError('')
            } else {
                refreshParticipants()
            }
        }

        client.on('user-added', handleParticipantChange)
        client.on('user-removed', handleParticipantChange)
        client.on('user-updated', handleParticipantChange)
        client.on('connection-change', handleConnectionChange)

        refreshParticipants()

        return () => {
            client.off('user-added', handleParticipantChange)
            client.off('user-removed', handleParticipantChange)
            client.off('user-updated', handleParticipantChange)
            client.off('connection-change', handleConnectionChange)
        }
    }, [client, refreshParticipants])

    return { participants, refreshParticipants, participantError, }
}

export default useParticipants