import { Link } from "react-router-dom";
import { tr } from "../lib/lang.js";
import { issueById, readPicks, MAX_PICKS } from "../lib/issues.js";

// A small way into /issues from the home page. Once issues are picked on this device, it names them.
export default function IssuesCard() {
  const picks = readPicks().map(issueById).filter(Boolean);
  return (
    <Link to="/issues" className="issues-card feature-card">
      {picks.length ? (
        <>
          <strong>{tr("Your issues", "Sus temas")}</strong>
          <p>{picks.map((i) => tr(i.en, i.es)).join(" · ")}</p>
          <p>{tr("See what Congress did on them →", "Vea lo que hizo el Congreso sobre ellos →")}</p>
        </>
      ) : (
        <>
          <strong>{tr("Pick the issues you care about", "Elija los temas que le importan")}</strong>
          <p>{tr(`Up to ${MAX_PICKS}, like health care or jobs. See what Congress did on them and how your members voted.`,
            `Hasta ${MAX_PICKS}, como salud o empleo. Vea lo que hizo el Congreso sobre ellos y cómo votaron sus miembros.`)}</p>
        </>
      )}
    </Link>
  );
}
