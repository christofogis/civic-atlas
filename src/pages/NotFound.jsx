import { Link } from "react-router-dom";
import { tr } from "../lib/lang.js";

export default function NotFound() {
  return (
    <main className="page">
      <h1>{tr("Page not found", "Página no encontrada")}</h1>
      <p><Link to="/">{tr("Back to search", "Volver a la búsqueda")}</Link></p>
    </main>
  );
}
