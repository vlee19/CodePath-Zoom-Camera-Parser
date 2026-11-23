import FLAGS from "../constants/flags"

function ParticipantList({ participants, participantFlags, onFlagChange }) {
    return (
        <section>
            <h2>All Participants</h2>

            {participants.length === 0 ? (
                <p>No participants found.</p>
            ) : (
                <ul>
                    {participants.map((participant) => (
                        <li key={participant.userId}>
                            {participant.displayName}

                            {" "}

                            <span>
                                {typeof participant.video === "boolean" 
                                    ? participant.video 
                                        ? "Camera on" 
                                        : "Camera off" 
                                    : "Camera status unavilable"}
                            </span>

                            {" "}

                            <select
                                value={participantFlags[participant.userId] || ""}
                                onChange={(event) => 
                                    onFlagChange(
                                        participant.userId,
                                        event.target.value
                                    )
                                }
                            >
                                <option value="">No flag</option>

                                {FLAGS.map((flag) => (
                                    <option key={flag} value={flag}>
                                        {flag}
                                    </option>
                                ))}
                            </select>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

export default ParticipantList