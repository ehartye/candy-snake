import { useState, useEffect, useCallback, useRef, memo } from "react";

const GRID_SIZE = 20;
const CELL_SIZE = 22;
const INITIAL_SPEED = 140;
const SPEED_INCREMENT = 3;
const MIN_SPEED = 50;
const NUM_CANDIES = 5;

const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

const OPPOSITES = {
  "0,-1": "0,1",
  "0,1": "0,-1",
  "-1,0": "1,0",
  "1,0": "-1,0",
};

const CANDIES = ["🍬", "🍭", "🍩", "🧁", "🍪", "🍫", "🍰", "🎂", "🍮", "🍡"];
const SNAKE_COLORS = [
  "#ff6b9d", "#ff85ab", "#ff9fba", "#ffb8c9", "#ffd1d8",
  "#ffe0e6", "#ffecf0", "#fff5f7",
];

const POINTS = {
  "🍬": 10, "🍭": 10, "🍪": 10,
  "🍩": 15, "🍫": 15, "🍡": 15,
  "🧁": 20, "🍰": 20,
  "🍮": 25, "🎂": 30,
};

const BOARD_PX = GRID_SIZE * CELL_SIZE;

// Static checkerboard grid - never re-renders
const Grid = memo(function Grid() {
  return (
    <>
      {Array.from({ length: GRID_SIZE }, (_, row) =>
        Array.from({ length: GRID_SIZE }, (_, col) => (
          <div
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              left: col * CELL_SIZE,
              top: row * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              background:
                (row + col) % 2 === 0
                  ? "rgba(255,182,206,0.08)"
                  : "rgba(212,180,247,0.06)",
            }}
          />
        ))
      )}
    </>
  );
});

function isOccupied(pos, snake, foods) {
  if (snake.some((s) => s.x === pos.x && s.y === pos.y)) return true;
  if (foods.some((f) => f.x === pos.x && f.y === pos.y)) return true;
  return false;
}

function getRandomPosition(snake, foods) {
  let pos;
  let tries = 0;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    tries++;
  } while (isOccupied(pos, snake, foods) && tries < 400);
  return pos;
}

function randomCandy() {
  return CANDIES[Math.floor(Math.random() * CANDIES.length)];
}

function spawnFoods(count, snake, existing) {
  const foods = [...existing];
  for (let i = 0; i < count; i++) {
    const pos = getRandomPosition(snake, foods);
    foods.push({ ...pos, emoji: randomCandy(), id: Date.now() + Math.random() });
  }
  return foods;
}

export default function SnakeGame() {
  const [gameState, setGameState] = useState("idle");
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [foods, setFoods] = useState([]);
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [particles, setParticles] = useState([]);
  const [combo, setCombo] = useState(null);
  const [, setFrame] = useState(0);

  const dirRef = useRef(direction);
  const snakeRef = useRef(snake);
  const foodsRef = useRef(foods);
  const scoreRef = useRef(score);
  const gameStateRef = useRef(gameState);
  const queuedDir = useRef(null);
  const prevSnakeRef = useRef([{ x: 10, y: 10 }]);
  const interpRef = useRef(0);

  dirRef.current = direction;
  snakeRef.current = snake;
  foodsRef.current = foods;
  scoreRef.current = score;
  gameStateRef.current = gameState;

  const spawnParticles = useCallback((x, y) => {
    const emojis = ["✨", "⭐", "💖", "🌟", "💫", "🎀"];
    const newParticles = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i + Math.random(),
      x: x * CELL_SIZE + CELL_SIZE / 2,
      y: y * CELL_SIZE + CELL_SIZE / 2,
      angle: (Math.PI * 2 * i) / 6,
      emoji: emojis[i],
    }));
    setParticles((p) => [...p, ...newParticles]);
    setTimeout(() => setParticles((p) => p.filter((pp) => !newParticles.includes(pp))), 600);
  }, []);

  const showCombo = useCallback((text) => {
    setCombo({ text, id: Date.now() });
    setTimeout(() => setCombo(null), 800);
  }, []);

  const startGame = useCallback(() => {
    const initial = [{ x: 10, y: 10 }];
    setSnake(initial);
    prevSnakeRef.current = initial;
    interpRef.current = 0;
    setDirection({ x: 1, y: 0 });
    dirRef.current = { x: 1, y: 0 };
    queuedDir.current = null;
    setFoods(spawnFoods(NUM_CANDIES, initial, []));
    setScore(0);
    setGameState("playing");
  }, []);

  const tick = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    const dir = queuedDir.current || dirRef.current;
    if (queuedDir.current) {
      setDirection(queuedDir.current);
      dirRef.current = queuedDir.current;
      queuedDir.current = null;
    }

    const currentSnake = snakeRef.current;
    prevSnakeRef.current = currentSnake;

    const head = currentSnake[0];
    const newHead = {
      x: (head.x + dir.x + GRID_SIZE) % GRID_SIZE,
      y: (head.y + dir.y + GRID_SIZE) % GRID_SIZE,
    };

    if (currentSnake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      setGameState("over");
      setHighScore((h) => Math.max(h, scoreRef.current));
      return;
    }

    const currentFoods = foodsRef.current;
    const eatenIndex = currentFoods.findIndex((f) => f.x === newHead.x && f.y === newHead.y);
    const ate = eatenIndex !== -1;
    const eatenFood = ate ? currentFoods[eatenIndex] : null;

    const newSnake = ate
      ? [newHead, ...currentSnake]
      : [newHead, ...currentSnake.slice(0, -1)];

    setSnake(newSnake);

    if (ate) {
      const pts = POINTS[eatenFood.emoji] || 10;
      const newScore = scoreRef.current + pts;
      setScore(newScore);

      const remaining = currentFoods.filter((_, i) => i !== eatenIndex);
      const newFoods = spawnFoods(1, newSnake, remaining);
      setFoods(newFoods);

      spawnParticles(eatenFood.x, eatenFood.y);
      const msgs = [
        `+${pts} Yummy! 😋`,
        `+${pts} Sweet! 🍬`,
        `+${pts} Tasty! 🎉`,
        `+${pts} Nom nom! 💕`,
        `+${pts} Delish! ✨`,
        `+${pts} Sugar rush! 🍭`,
      ];
      showCombo(msgs[Math.floor(Math.random() * msgs.length)]);
    }
  }, [spawnParticles, showCombo]);

  // rAF game loop: ticks at game speed, renders at 60fps with interpolation
  useEffect(() => {
    if (gameState !== "playing") return;
    const speed = Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(score / 30) * SPEED_INCREMENT);
    let lastTick = performance.now();
    let rafId;

    const loop = (now) => {
      rafId = requestAnimationFrame(loop);
      if (now - lastTick >= speed) {
        lastTick += speed;
        // Prevent spiral if tab was backgrounded
        if (now - lastTick > speed * 2) lastTick = now;
        tick();
      }
      interpRef.current = Math.min(1, (now - lastTick) / speed);
      setFrame((f) => f + 1);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [gameState, tick, score]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (gameState === "idle" || gameState === "over") startGame();
        else if (gameState === "playing") setGameState("paused");
        else if (gameState === "paused") setGameState("playing");
        return;
      }
      const newDir = DIRECTIONS[e.key];
      if (!newDir) return;
      e.preventDefault();
      const current = queuedDir.current || dirRef.current;
      const currentKey = `${current.x},${current.y}`;
      const newKey = `${newDir.x},${newDir.y}`;
      if (OPPOSITES[currentKey] === newKey || currentKey === newKey) return;
      queuedDir.current = newDir;
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameState, startGame]);

  const touchStart = useRef(null);
  const handleTouchStart = (e) => {
    if (gameStateRef.current === "playing") e.preventDefault();
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e) => {
    if (gameStateRef.current === "playing") e.preventDefault();
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    let newDir;
    if (Math.abs(dx) > Math.abs(dy)) {
      newDir = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    } else {
      newDir = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
    const current = queuedDir.current || dirRef.current;
    const currentKey = `${current.x},${current.y}`;
    const newKey = `${newDir.x},${newDir.y}`;
    if (OPPOSITES[currentKey] !== newKey && currentKey !== newKey) {
      queuedDir.current = newDir;
    }
    touchStart.current = null;
  };

  const snakeColor = (i, len) => {
    const idx = Math.min(Math.floor((i / Math.max(len, 1)) * SNAKE_COLORS.length), SNAKE_COLORS.length - 1);
    return SNAKE_COLORS[idx];
  };

  // Interpolate snake position, snapping on board wrap-around
  const t = interpRef.current;
  const prev = prevSnakeRef.current;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #fff5f7 0%, #fce4ec 25%, #f8e8ff 50%, #e8f4fd 75%, #fff9e6 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "'Nunito', 'Quicksand', 'Comic Sans MS', sans-serif",
        color: "#6b4c6e",
        userSelect: "none",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&family=Fredoka+One&display=swap" rel="stylesheet" />

      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "fixed",
            fontSize: 20 + (i % 3) * 8,
            opacity: 0.12,
            left: `${(i * 17 + 5) % 95}%`,
            top: `${(i * 23 + 8) % 90}%`,
            animation: `floatCandy ${4 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.4}s`,
            pointerEvents: "none",
          }}
        >
          {CANDIES[i % CANDIES.length]}
        </div>
      ))}

      <div
        style={{
          width: BOARD_PX,
          maxWidth: "calc(100vw - 32px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          marginBottom: 14,
          padding: "0 4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 30,
              fontFamily: "'Fredoka One', 'Nunito', cursive",
              fontWeight: 900,
              background: "linear-gradient(135deg, #ff6b9d, #c44dff, #ff6b9d)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "none",
              filter: "drop-shadow(0 2px 4px rgba(196,77,255,0.3))",
            }}
          >
            🍭 Candy Snake
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, fontWeight: 700 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              padding: "4px 12px",
              borderRadius: 20,
              border: "2px solid #ffd1dc",
              boxShadow: "0 2px 8px rgba(255,107,157,0.15)",
            }}
          >
            <span style={{ color: "#d4a0b0" }}>🍬 </span>
            <span style={{ color: "#ff6b9d" }}>{String(score).padStart(4, "0")}</span>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              padding: "4px 12px",
              borderRadius: 20,
              border: "2px solid #d4c4f7",
              boxShadow: "0 2px 8px rgba(196,77,255,0.1)",
            }}
          >
            <span style={{ color: "#b8a0d4" }}>👑 </span>
            <span style={{ color: "#9b59b6" }}>{String(highScore).padStart(4, "0")}</span>
          </div>
        </div>
      </div>

      {combo && (
        <div
          key={combo.id}
          style={{
            position: "absolute",
            top: "28%",
            zIndex: 500,
            fontSize: 22,
            fontFamily: "'Fredoka One', cursive",
            fontWeight: 900,
            color: "#ff6b9d",
            textShadow: "0 2px 8px rgba(255,107,157,0.4)",
            animation: "comboPopup 0.8s ease-out forwards",
            pointerEvents: "none",
          }}
        >
          {combo.text}
        </div>
      )}

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          maxWidth: BOARD_PX,
          maxHeight: BOARD_PX,
          background: "linear-gradient(135deg, #fff9fb, #fff0f5, #fef5ff, #f5f0ff)",
          border: "3px solid #ffd1dc",
          borderRadius: 16,
          boxShadow:
            "0 8px 32px rgba(255,107,157,0.15), 0 2px 8px rgba(196,77,255,0.1), inset 0 0 40px rgba(255,255,255,0.5)",
          overflow: "hidden",
        }}
      >
        <Grid />

        {foods.map((f) => (
          <div
            key={f.id}
            style={{
              position: "absolute",
              width: CELL_SIZE,
              height: CELL_SIZE,
              transform: `translate3d(${f.x * CELL_SIZE}px, ${f.y * CELL_SIZE}px, 0)`,
              willChange: "transform",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              animation: "candyBounce 0.8s ease-in-out infinite",
              animationDelay: `${(f.x * 0.1 + f.y * 0.07) % 0.8}s`,
              filter: "drop-shadow(0 2px 4px rgba(255,107,157,0.4))",
              zIndex: 50,
            }}
          >
            {f.emoji}
          </div>
        ))}

        {snake.map((seg, i) => {
          const isHead = i === 0;
          const isTail = i === snake.length - 1 && snake.length > 1;
          const size = isHead ? CELL_SIZE - 1 : CELL_SIZE - 3;
          const offset = isHead ? 0.5 : 1.5;
          const color = snakeColor(i, snake.length);

          // Interpolate between previous and current position
          const p = prev[i];
          let rx, ry;
          if (p && Math.abs(seg.x - p.x) <= 1 && Math.abs(seg.y - p.y) <= 1) {
            rx = p.x + (seg.x - p.x) * t;
            ry = p.y + (seg.y - p.y) * t;
          } else {
            // No previous position or board wrap — snap
            rx = seg.x;
            ry = seg.y;
          }

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: size,
                height: size,
                transform: `translate3d(${rx * CELL_SIZE + offset}px, ${ry * CELL_SIZE + offset}px, 0)`,
                willChange: "transform",
                background: isHead
                  ? "linear-gradient(135deg, #ff6b9d, #ff85ab)"
                  : `linear-gradient(135deg, ${color}, ${color}dd)`,
                borderRadius: isHead ? 7 : isTail ? "50%" : 5,
                boxShadow: isHead
                  ? "0 3px 10px rgba(255,107,157,0.5), inset 0 1px 2px rgba(255,255,255,0.4)"
                  : `0 2px 6px rgba(255,107,157,${Math.max(0.1, 0.3 - i * 0.02)})`,
                border: isHead ? "2px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.3)",
                zIndex: 100 - i,
              }}
            >
              {isHead && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      width: 7,
                      height: 8,
                      background: "white",
                      borderRadius: "50%",
                      top: direction.y === 1 ? "50%" : direction.y === -1 ? "5%" : "18%",
                      left: direction.x === 1 ? "50%" : direction.x === -1 ? "5%" : "12%",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: 4,
                        height: 4,
                        background: "#4a2040",
                        borderRadius: "50%",
                        bottom: 1,
                        right: direction.x === -1 ? 0 : direction.x === 1 ? "auto" : 1,
                        left: direction.x === 1 ? 0 : "auto",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      width: 7,
                      height: 8,
                      background: "white",
                      borderRadius: "50%",
                      top: direction.y === 1 ? "50%" : direction.y === -1 ? "5%" : "18%",
                      right: direction.x === -1 ? "50%" : direction.x === 1 ? "5%" : "12%",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: 4,
                        height: 4,
                        background: "#4a2040",
                        borderRadius: "50%",
                        bottom: 1,
                        right: direction.x === -1 ? 0 : direction.x === 1 ? "auto" : 1,
                        left: direction.x === 1 ? 0 : "auto",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      width: 5,
                      height: 3,
                      background: "rgba(255,150,180,0.6)",
                      borderRadius: "50%",
                      bottom: direction.y === -1 ? "15%" : "20%",
                      left: "5%",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      width: 5,
                      height: 3,
                      background: "rgba(255,150,180,0.6)",
                      borderRadius: "50%",
                      bottom: direction.y === -1 ? "15%" : "20%",
                      right: "5%",
                    }}
                  />
                </>
              )}
              {!isHead && i < 4 && (
                <div
                  style={{
                    position: "absolute",
                    width: 4,
                    height: 4,
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "50%",
                    top: 2,
                    left: 2,
                  }}
                />
              )}
            </div>
          );
        })}

        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: p.x + Math.cos(p.angle) * 20 - 6,
              top: p.y + Math.sin(p.angle) * 20 - 6,
              fontSize: 12,
              animation: "sparkle 0.6s ease-out forwards",
              pointerEvents: "none",
              zIndex: 300,
            }}
          >
            {p.emoji}
          </div>
        ))}

        {gameState === "idle" && (
          <Overlay>
            <div style={{ fontSize: 48, marginBottom: 4 }}>🍭</div>
            <div
              style={{
                fontSize: 36,
                fontFamily: "'Fredoka One', cursive",
                fontWeight: 900,
                background: "linear-gradient(135deg, #ff6b9d, #c44dff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Candy Snake
            </div>
            <div style={{ fontSize: 13, color: "#c4a0c8", marginTop: 4, letterSpacing: 1 }}>
              Collect all the sweets!
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 11, color: "#b888c0", flexWrap: "wrap", justifyContent: "center" }}>
              <span>🍬🍭🍪 10pts</span>
              <span>🍩🍫🍡 15pts</span>
              <span>🧁🍰 20pts</span>
              <span>🍮 25pts</span>
              <span>🎂 30pts</span>
            </div>
            <button onClick={startGame} style={btnStyle}>
              🍬 PLAY
            </button>
            <div style={{ fontSize: 11, color: "#d4b8d8", marginTop: 10 }}>
              Arrow keys · WASD · Swipe
            </div>
          </Overlay>
        )}

        {gameState === "paused" && (
          <Overlay>
            <div style={{ fontSize: 36 }}>🍫</div>
            <div
              style={{
                fontSize: 26,
                fontFamily: "'Fredoka One', cursive",
                fontWeight: 900,
                color: "#c44dff",
                marginTop: 4,
              }}
            >
              Paused
            </div>
            <button onClick={() => setGameState("playing")} style={btnStyle}>
              ▶ RESUME
            </button>
          </Overlay>
        )}

        {gameState === "over" && (
          <Overlay>
            <div style={{ fontSize: 36 }}>😵</div>
            <div
              style={{
                fontSize: 26,
                fontFamily: "'Fredoka One', cursive",
                fontWeight: 900,
                color: "#ff6b9d",
                marginTop: 4,
              }}
            >
              Sugar Crash!
            </div>
            <div style={{ fontSize: 15, color: "#b888c0", marginTop: 4 }}>
              Score: <span style={{ color: "#ff6b9d", fontWeight: 700 }}>{score}</span> 🍬
            </div>
            {score >= highScore && score > 0 && (
              <div style={{ fontSize: 13, color: "#c44dff", marginTop: 2 }}>
                ✨ New High Score! ✨
              </div>
            )}
            <button onClick={startGame} style={btnStyle}>
              🔄 TRY AGAIN
            </button>
          </Overlay>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          marginTop: 14,
        }}
      >
        <MobileBtn
          label="▲"
          onClick={() => {
            if (gameState === "idle" || gameState === "over") { startGame(); return; }
            const current = queuedDir.current || dirRef.current;
            if (current.y !== 1) queuedDir.current = { x: 0, y: -1 };
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <MobileBtn
            label="◄"
            onClick={() => {
              if (gameState === "idle" || gameState === "over") { startGame(); return; }
              const current = queuedDir.current || dirRef.current;
              if (current.x !== 1) queuedDir.current = { x: -1, y: 0 };
            }}
          />
          <MobileBtn
            label="▼"
            onClick={() => {
              if (gameState === "idle" || gameState === "over") { startGame(); return; }
              const current = queuedDir.current || dirRef.current;
              if (current.y !== -1) queuedDir.current = { x: 0, y: 1 };
            }}
          />
          <MobileBtn
            label="►"
            onClick={() => {
              if (gameState === "idle" || gameState === "over") { startGame(); return; }
              const current = queuedDir.current || dirRef.current;
              if (current.x !== -1) queuedDir.current = { x: 1, y: 0 };
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "#d4b8d8", letterSpacing: 1 }}>
        SPACE TO PAUSE
      </div>
      </div>

      <style>{`
        @keyframes candyBounce {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.15) rotate(-5deg); }
          75% { transform: scale(1.1) rotate(5deg); }
        }
        @keyframes sparkle {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(1.5) translateY(-15px); }
        }
        @keyframes comboPopup {
          0% { opacity: 0; transform: scale(0.5) translateY(10px); }
          30% { opacity: 1; transform: scale(1.1) translateY(-5px); }
          100% { opacity: 0; transform: scale(1) translateY(-30px); }
        }
        @keyframes floatCandy {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(8deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function Overlay({ children }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255,245,250,0.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      {children}
    </div>
  );
}

function MobileBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 52,
        height: 52,
        background: "linear-gradient(135deg, #fff, #fff5f7)",
        border: "2px solid #ffd1dc",
        borderRadius: 14,
        color: "#ff6b9d",
        fontSize: 18,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        WebkitTapHighlightColor: "transparent",
        boxShadow: "0 3px 8px rgba(255,107,157,0.15)",
      }}
    >
      {label}
    </button>
  );
}

const btnStyle = {
  marginTop: 16,
  padding: "10px 32px",
  background: "linear-gradient(135deg, #ff6b9d, #c44dff)",
  border: "none",
  color: "white",
  fontSize: 15,
  fontWeight: 800,
  fontFamily: "'Fredoka One', 'Nunito', cursive",
  letterSpacing: 2,
  borderRadius: 25,
  cursor: "pointer",
  boxShadow: "0 4px 15px rgba(255,107,157,0.4)",
  transition: "all 0.2s",
};
