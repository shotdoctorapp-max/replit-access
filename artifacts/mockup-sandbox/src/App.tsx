import React, { useEffect, useState } from "react";
import { modules } from "./.generated/mockup-components";

function NotFound({ path }: { path: string }) {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", color: "#888" }}>
      <h2>Preview not found</h2>
      <p>No component matched: <code>{path}</code></p>
      <p>Available:</p>
      <ul>
        {Object.keys(modules).map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // URL: /preview/mockups/ComponentName  (base path stripped by vite)
    const pathname = window.location.pathname;
    const match = pathname.match(/\/preview\/(.+)/);
    if (!match) { setNotFound(true); return; }

    const slug = match[1]; // e.g. "mockups/LaunchScreenPreview"
    const key = `./components/mockups/${slug.split("/").pop()}.tsx`;
    const loader = modules[key];
    if (!loader) { setNotFound(true); return; }

    loader().then((mod: Record<string, unknown>) => {
      const keys = Object.keys(mod);
      const comp = (mod["default"] ?? mod[keys[0]]) as React.ComponentType;
      setComponent(() => comp);
    });
  }, []);

  if (notFound) return <NotFound path={window.location.pathname} />;
  if (!Component) return null;
  return <Component />;
}
