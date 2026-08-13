import React, { useState } from "react";
import Home from "./components/Home.jsx";
import Session from "./components/Session.jsx";

export default function App() {
  const [screen, setScreen] = useState("home"); // "home" | "session"
  const [currentId, setCurrentId] = useState(null);

  const openInterview = (id) => {
    setCurrentId(id);
    setScreen("session");
  };

  const goHome = () => {
    setScreen("home");
    setCurrentId(null);
  };

  return (
    <div className="it-app">
      <div className="it-inner">
        {screen === "home" ? (
          <Home onOpen={openInterview} />
        ) : (
          <Session interviewId={currentId} onHome={goHome} />
        )}
      </div>
    </div>
  );
}
