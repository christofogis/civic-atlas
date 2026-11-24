import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Member from "./pages/Member.jsx";
import Bill from "./pages/Bill.jsx";
import Methods from "./pages/Methods.jsx";
import NotFound from "./pages/NotFound.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/member/:bioguide" element={<Member />} />
        <Route path="/bill/:congress/:type/:number" element={<Bill />} />
        <Route path="/methods" element={<Methods />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
