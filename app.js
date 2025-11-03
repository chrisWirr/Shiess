import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, SafeAreaView, Alert, Dimensions, Image } from "react-native";

// Board constants
const SIZE = 8;
const YELLOW = "y";
const BLUE = "b";

// Dynamic square size
const { width } = Dimensions.get("window");
const SQUARE_SIZE = Math.floor(width / SIZE);

// Piece definitions
const PIECE_DEFS = {
  P: { special: "pawn" },
  R: { kind: "slider", dirs: [[1,0],[-1,0],[0,1],[0,-1]] },
  B: { kind: "slider", dirs: [[1,1],[1,-1],[-1,1],[-1,-1]] },
  Q: { kind: "slider", dirs: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] },
  N: { special: "knight" },
  H: { special: "hero" }, // Held statt König
  W: {
    kind: "compound",
    parts: [
      { kind: "slider", dirs: [[1,1],[1,-1],[-1,1],[-1,-1]] },
      { kind: "leaper", steps: [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]] }
    ]
  },
  L: { kind: "leaper", steps: [[2,0],[-2,0],[0,2],[0,-2]] },
};

// Helpers
const inBounds = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

function cloneBoard(board) {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function enemyColor(color) {
  return color === YELLOW ? BLUE : YELLOW;
}

// Check detection
function isHeroInCheck(board, color) {
  let heroPos = null;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const piece = board[y][x];
      if (piece && piece.type === "H" && piece.color === color) {
        heroPos = { x, y };
        break;
      }
    }
    if (heroPos) break;
  }
  if (!heroPos) return false;

  const enemy = enemyColor(color);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const piece = board[y][x];
      if (piece && piece.color === enemy) {
        const moves = genMoves(board, x, y);
        if (moves.some(m => m.x === heroPos.x && m.y === heroPos.y)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isMoveLegal(board, fromX, fromY, toX, toY, color) {
  const nb = cloneBoard(board);
  nb[toY][toX] = nb[fromY][fromX];
  nb[fromY][fromX] = null;
  return !isHeroInCheck(nb, color);
}

// Move generation
function genMoves(board, x, y) {
  const piece = board[y][x];
  if (!piece) return [];
  const color = piece.color;
  const type = piece.type;
  const def = PIECE_DEFS[type];
  if (!def) return [];

  let moves = [];
  if (def.special === "pawn") {
    moves = genPawnMoves(board, x, y, color, piece);
    console.log(`Pawn at ${x},${y} (${color}): Generated moves`, moves); // Debug-Log
  } else if (def.special === "hero") moves = genHeroMoves(board, x, y, color);
  else if (def.special === "knight") moves = genLeaperMoves(board, x, y, color, [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]);
  else if (def.kind === "slider") moves = genSliderMoves(board, x, y, color, def.dirs);
  else if (def.kind === "leaper") moves = genLeaperMoves(board, x, y, color, def.steps);
  else if (def.kind === "compound") {
    for (const part of def.parts) {
      if (part.kind === "slider") {
        moves = moves.concat(genSliderMoves(board, x, y, color, part.dirs));
      } else if (part.kind === "leaper") {
        moves = moves.concat(genLeaperMoves(board, x, y, color, part.steps));
      }
    }
    moves = [...new Set(moves.map(m => `${m.x},${m.y}`))].map(pos => {
      const [x, y] = pos.split(",").map(Number);
      return { x, y };
    });
  }

  return moves.filter(m => isMoveLegal(board, x, y, m.x, m.y, color));
}

function genSliderMoves(board, x, y, color, dirs) {
  const moves = [];
  for (const [dx, dy] of dirs) {
    let nx = x + dx, ny = y + dy;
    while (inBounds(nx, ny)) {
      const occ = board[ny][nx];
      if (!occ) {
        moves.push({ x: nx, y: ny });
      } else {
        if (occ.color !== color) moves.push({ x: nx, y: ny });
        break;
      }
      nx += dx; ny += dy;
    }
  }
  return moves;
}

function genLeaperMoves(board, x, y, color, steps) {
  const moves = [];
  for (const [dx, dy] of steps) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(nx, ny)) continue;
    const occ = board[ny][nx];
    if (!occ || occ.color !== color) moves.push({ x: nx, y: ny });
  }
  return moves;
}

function genHeroMoves(board, x, y, color) {
  const steps = [
    [1,0],[-1,0],[0,1],[0,-1],
    [1,1],[1,-1],[-1,1],[-1,-1]
  ];
  return genLeaperMoves(board, x, y, color, steps);
}

function genPawnMoves(board, x, y, color, piece) {
  const dir = color === YELLOW ? -1 : 1; // Gelb bewegt sich nach oben (-1), Blau nach unten (+1)
  const moves = [];
  const ny = y + dir;

  // Ein Feld vorwärts
  if (inBounds(x, ny) && !board[ny][x]) {
    moves.push({ x, y: ny });
    // Zwei Felder vorwärts (nur von der Startreihe)
    const startRank = color === YELLOW ? 6 : 1;
    const ny2 = y + 2 * dir;
    if (y === startRank && inBounds(x, ny2) && !board[ny2][x] && !board[ny][x]) {
      moves.push({ x, y: ny2 });
    }
  }
  // Schlagen
  for (const dx of [-1, 1]) {
    const cx = x + dx, cy = y + dir;
    if (inBounds(cx, cy)) {
      const occ = board[cy][cx];
      if (occ && occ.color !== color) {
        moves.push({ x: cx, y: cy });
      }
    }
  }
  return moves;
}

// Initial board
function makeStartBoard() {
  const emptyRow = () => Array(SIZE).fill(null);
  const b = Array.from({ length: SIZE }, emptyRow);

  for (let x = 0; x < SIZE; x++) {
    b[6][x] = { type: "P", color: YELLOW, moved: false };
    b[1][x] = { type: "P", color: BLUE, moved: false };
  }

  const yellowBack = ["R","W","B","Q","H","B","W","R"];
  yellowBack.forEach((t, x) => b[7][x] = { type: t, color: YELLOW, moved: false });

  const blueBack = ["R","L","B","Q","H","B","L","R"];
  blueBack.forEach((t, x) => b[0][x] = { type: t, color: BLUE, moved: false });

  return b;
}

// UI Components
function Square({ x, y, selected, highlight, piece, onPress }) {
  const light = (x + y) % 2 === 0;
  const bg = highlight
    ? "#ffd54f" // Gelb für markierte Felder
    : selected
      ? "#81c784" // Grün für ausgewählte Felder
      : light ? "#e6cce6" // Helles Lila für helle Felder
      : "#a64d79"; // Dunkles Rosa-Lila für dunkle Felder

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        borderWidth: 0.5,
        borderColor: "#a64d79" // Rahmenfarbe an dunkles Rosa angepasst
      }}
      activeOpacity={0.7}
      accessibilityLabel={piece ? `${piece.color === YELLOW ? "Yellow" : "Blue"} ${piece.type} at ${String.fromCharCode(97 + x)}${SIZE - y}` : `Empty square at ${String.fromCharCode(97 + x)}${SIZE - y}`}
    >
      {piece ? (
        <Image
          source={pieceImage(piece)}
          style={{ width: SQUARE_SIZE * 0.8, height: SQUARE_SIZE * 0.8 }}
          resizeMode="contain"
        />
      ) : null}
    </TouchableOpacity>
  );
}

function pieceImage(p) {
  const map = {
    yP: require("./yP.png"),
    bP: require("./bP.png"),
    yR: require("./yR.png"),
    bR: require("./bR.png"),
    yN: require("./yN.png"),
    bN: require("./bN.png"),
    yB: require("./yB.png"),
    bB: require("./bB.png"),
    yQ: require("./yQ.png"),
    bQ: require("./bQ.png"),
    yH: require("./yH.png"),  // Gelber Held
    bH: require("./bH.png"),  // Blauer Held
    yW: require("./yW.png"),
    bW: require("./bW.png"),
    yL: require("./yL.png"),
    bL: require("./bL.png"),
  };
  const key = p.color + p.type;
  const source = map[key];
  console.log(`Versuche Bild für ${key}: ${source ? 'OK' : 'FEHLT'}`);
  if (!source) {
    console.error(`Bild für ${key} fehlt! Stelle sicher, dass ${key}.png im Root-Verzeichnis ist.`);
    return require("./unknown.png"); // Fallback auf unbekanntes Bild
  }
  return source;
}

function Btn({ label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: "#444",
        borderRadius: 10,
        marginRight: 8
      }}
      accessibilityLabel={label}
    >
      <Text style={{ color: "white", fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [board, setBoard] = useState(makeStartBoard);
  const [turn, setTurn] = useState(YELLOW);
  const [sel, setSel] = useState(null);
  const [moves, setMoves] = useState([]);
  const [flipBoard, setFlipBoard] = useState(false);

  const reset = () => {
    setBoard(makeStartBoard());
    setTurn(YELLOW);
    setSel(null);
    setMoves([]);
    setFlipBoard(false);
  };

  const genMovesMemo = useMemo(() => genMoves, []);

  function handleSquarePress(x, y) {
    const cell = board[y][x];
    console.log(`Pressed ${x},${y}, cell:`, cell, "Turn:", turn); // Debug-Log

    if (sel && moves.some(m => m.x === x && m.y === y)) {
      const nb = cloneBoard(board);
      const src = nb[sel.y][sel.x];
      const isPawn = src.type === "P";
      const backRank = src.color === YELLOW ? 0 : 7;
      const newType = isPawn && y === backRank ? "Q" : src.type;
      nb[y][x] = { type: newType, color: src.color, moved: true };
      nb[sel.y][sel.x] = null;

      setBoard(nb);
      setSel(null);
      setMoves([]);
      setTurn(t => (t === YELLOW ? BLUE : YELLOW));
      return;
    }

    if (cell && cell.color === turn) {
      const legal = genMovesMemo(board, x, y);
      console.log(`Legal moves for ${x},${y}:`, legal); // Debug-Log
      setSel({ x, y });
      setMoves(legal);
    } else {
      setSel(null);
      setMoves([]);
    }
  }

  const turnText = turn === YELLOW ? "Yellow to move" : "Blue to move";
  const displayBoard = flipBoard ? board.slice().reverse() : board;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#222" }}>
      <View style={{ padding: 12 }}>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>Chess+ (local)</Text>
        <Text style={{ color: "#ddd", marginTop: 6 }}>{turnText}</Text>
        <View style={{ height: 12 }} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn label="New Game" onPress={reset} />
          <Btn label="Flip Board" onPress={() => setFlipBoard(f => !f)} />
          <Btn label="Help" onPress={() => {
            Alert.alert("How to play",
              "• Tap a piece to see its legal moves.\n• Tap a highlighted square to move.\n• Yellow moves up; blue moves down.\n• Pawns promote to queens on the back rank.\n\nPiece Movements:\n  - Pawn (P): Moves 1 square forward (or 2 from start). Captures diagonally 1 square forward.\n  - Rook (R): Moves any number of squares horizontally or vertically.\n  - Bishop (B): Moves any number of squares diagonally.\n  - Queen (Q): Moves any number of squares horizontally, vertically, or diagonally.\n  - Knight (N): Jumps in an L-shape (2 squares one way, 1 square perpendicular).\n  - Hero (H): Moves 1 square in any direction (like a king).\n  - Wizard (W): Combines Bishop (diagonal) and Knight (L-shape) moves.\n  - Leaper (L): Jumps 2 squares horizontally or vertically.\n\n• Moves that put your hero in check are blocked.\n• Custom pieces: W (Wizard), L (Leaper).\n• This is a minimal demo (no checkmate yet)."
            );
          }} />
        </View>
      </View>

      <View style={{ alignItems: "center", marginTop: 8 }}>
        <View style={{ flexDirection: "row", marginLeft: SQUARE_SIZE * 0.5, marginBottom: 4 }}>
          {Array(SIZE).fill().map((_, x) => (
            <Text key={x} style={{ width: SQUARE_SIZE, textAlign: "center", color: "#ddd" }}>
              {String.fromCharCode(97 + (flipBoard ? SIZE - 1 - x : x))}
            </Text>
          ))}
        </View>
        {displayBoard.map((row, y) => (
          <View key={y} style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ width: 20, color: "#ddd", textAlign: "center", lineHeight: SQUARE_SIZE }}>
              {flipBoard ? y + 1 : SIZE - y}
            </Text>
            {(flipBoard ? row.slice().reverse() : row).map((piece, x) => {
              const boardX = flipBoard ? SIZE - 1 - x : x;
              const boardY = flipBoard ? SIZE - 1 - y : y;
              const selected = sel && sel.x === boardX && sel.y === boardY;
              const highlight = moves.some(m => m.x === boardX && m.y === boardY);
              return (
                <Square
                  key={x}
                  x={boardX}
                  y={boardY}
                  piece={piece}
                  selected={!!selected}
                  highlight={highlight}
                  onPress={() => handleSquarePress(boardX, boardY)}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ padding: 12 }}>
        <Text style={{ color: "#aaa", marginTop: 8 }}>
          Add your own pieces by editing PIECE_DEFS. Use:
          {"\n"}• kind: "slider" with dirs [[dx,dy]...]
          {"\n"}• kind: "leaper" with steps [[dx,dy]...]
          {"\n"}• kind: "compound" with parts [...]
          {"\n"}• special: "pawn", "hero", "knight"
        </Text>
      </View>
    </SafeAreaView>
  );
}
