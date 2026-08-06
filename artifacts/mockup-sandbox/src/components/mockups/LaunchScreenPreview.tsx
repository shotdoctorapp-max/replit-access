export default function LaunchScreenPreview() {
  return (
    <div
      style={{
        width: 393,
        height: 852,
        backgroundColor: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          paddingLeft: 40,
          paddingRight: 40,
          textAlign: "center",
        }}
      >
        {/* Basketball icon */}
        <svg
          width="52"
          height="52"
          viewBox="0 0 24 24"
          fill="none"
          style={{ marginBottom: 8, opacity: 0.9 }}
        >
          <circle cx="12" cy="12" r="10" fill="#FF6B00" />
          <path
            d="M12 2C12 2 12 22 12 22M2 12H22M4.93 4.93C4.93 4.93 19.07 19.07 19.07 19.07M19.07 4.93C19.07 4.93 4.93 19.07 4.93 19.07"
            stroke="#000"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Quote */}
        <p
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: 300,
            lineHeight: 1.6,
            letterSpacing: 0.3,
            margin: 0,
          }}
        >
          "And see if there be any wicked way in me, and lead me in the way everlasting."
        </p>

        {/* Attribution */}
        <p
          style={{
            color: "#888888",
            fontSize: 13,
            fontStyle: "italic",
            letterSpacing: 0.5,
            margin: 0,
          }}
        >
          Psalm 139:24
        </p>
      </div>
    </div>
  );
}
