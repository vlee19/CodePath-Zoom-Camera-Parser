import FLAGS from "../constants/flags"

function FlaggedParticipants({ participants, participantFlags }) {
    return (
        <div>
            {FLAGS.map((flag) => {
                const flaggedParticipants = participants.filter(
                    (participant) => participantFlags[participant.userId] === flag
                )

                return (
                    <section key={flag}>
                        <h2>{flag}</h2>

                        {flaggedParticipants.length === 0 ? (
                            <p>No participants flagged</p>
                            ) : (
                                <ul>
                                    {flaggedParticipants.map((participant) => (
                                        <li key={participant.userId}>
                                            {participant.displayName}
                                        </li>
                                    ))}
                                </ul>
                            )
                        }
                    </section>
                )
            })}
        </div>
    )
}

export default FlaggedParticipants