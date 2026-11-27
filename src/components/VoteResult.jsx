import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { tr } from "../lib/lang.js";
import { isSpeakerElection, tallyByVote } from "../../lib/leadership.js";

// All Speaker election tallies, loaded once per page view and shared (a few hundred rows).
let speakerTallies = null;
function loadSpeakerTallies() {
  speakerTallies ??= db.from("speaker_ballot_tallies").select("vote_id,position,position_category,votes").limit(5000)
    .then(({ data, error }) => (error ? null : tallyByVote(data)))
    .catch(() => null);
  return speakerTallies;
}

// A roll call's result as the Clerk recorded it. On an Election of the Speaker the Clerk records
// the name with the most votes even when no one had a majority, so the ballot's outcome is added
// next to it: whether anyone received a majority of the votes cast for a person by name.
export default function VoteResult({ v, plain = false }) {
  const speaker = isSpeakerElection(v?.question);
  const [tally, setTally] = useState(null);
  useEffect(() => {
    if (!speaker || !v?.vote_id) return;
    let live = true;
    loadSpeakerTallies().then((m) => { if (live) setTally(m?.get(v.vote_id) ?? null); });
    return () => { live = false; };
  }, [speaker, v?.vote_id]);

  if (!speaker || !tally || !(tally.cast > 0)) return <span lang="en">{v?.result}</span>;
  const note = tally.majority
    ? tr(`${tally.majority} received a majority of the ${tally.cast} votes cast for a named candidate`, `${tally.majority} recibió la mayoría de los ${tally.cast} votos emitidos por un candidato con nombre`)
    : tr(`no candidate received a majority of the ${tally.cast} votes cast for a named candidate`, `ningún candidato recibió la mayoría de los ${tally.cast} votos emitidos por un candidato con nombre`);
  // plain: no in-site link (embeds run inside other sites' pages).
  return (
    <>
      <span lang="en">{v.result}</span>{" "}
      {plain ? <span className="fine">({note})</span> : <Link to="/leadership" className="fine">({note})</Link>}
    </>
  );
}
