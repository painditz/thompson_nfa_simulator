/**
 * ============================================================================
 * Regular Expression to ε-NFA Simulator (Thompson's Construction)
 * Course: CSET302 – Automata Theory & Computability
 * Batch: 75 · Group: 19
 * Contributors: Ashmit (S24CSEU2751), Vishnu (S24CSEU2758), Ajay (S24CSEU2827), Aditya (S24CSEU2754)
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// GLOBAL SIMULATOR STATE
// ----------------------------------------------------------------------------
let nfa = null;
let steps = [];
let currentStep = 0;

// SVG Interactive Pan & Zoom State
let zoomLevel = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let baseViewBox = { width: 900, height: 420 };

// ----------------------------------------------------------------------------
// 1. LEXICAL ANALYSIS & TOKENIZATION
// ----------------------------------------------------------------------------
function tokenizeRegex(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) continue;
    if ("()|*+?".includes(c) || c === "ε") {
      out.push(c);
    } else if (/[A-Za-z0-9_]/.test(c)) {
      out.push(c);
    } else {
      throw new Error(`Unsupported character "${c}" at position ${i + 1}.`);
    }
  }
  if (!out.length) {
    throw new Error("Enter a regular expression first.");
  }
  return out;
}

// ----------------------------------------------------------------------------
// 2. EXPLICIT CONCATENATION PREPROCESSING
// ----------------------------------------------------------------------------
function addConcat(tokens) {
  const out = [];
  const ends = (t) =>
    t === ")" || t === "*" || t === "+" || t === "?" || (t !== "|" && t !== "(");
  const starts = (t) =>
    t === "(" || (t !== "|" && t !== ")" && t !== "*" && t !== "+" && t !== "?");

  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i]);
    if (i < tokens.length - 1 && ends(tokens[i]) && starts(tokens[i + 1])) {
      out.push(".");
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// 3. INFIX-TO-POSTFIX (DIJKSTRA'S SHUNTING-YARD ALGORITHM)
// ----------------------------------------------------------------------------
function toPostfix(tokens) {
  const prec = { "|": 1, ".": 2 };
  const output = [];
  const stack = [];

  for (const t of tokens) {
    if (t === "(") {
      stack.push(t);
    } else if (t === ")") {
      while (stack.length && stack.at(-1) !== "(") {
        output.push(stack.pop());
      }
      if (!stack.length) {
        throw new Error("Mismatched parentheses.");
      }
      stack.pop();
    } else if (t === "*" || t === "+" || t === "?") {
      output.push(t);
    } else if (t === "|" || t === ".") {
      while (
        stack.length &&
        stack.at(-1) !== "(" &&
        prec[stack.at(-1)] >= prec[t]
      ) {
        output.push(stack.pop());
      }
      stack.push(t);
    } else {
      output.push(t);
    }
  }

  while (stack.length) {
    const x = stack.pop();
    if (x === "(") {
      throw new Error("Mismatched parentheses.");
    }
    output.push(x);
  }

  return output;
}

// ----------------------------------------------------------------------------
// 4. THOMPSON'S INDUCTIVE CONSTRUCTION ALGORITHM
// ----------------------------------------------------------------------------
function rawThompson(postfix) {
  let id = 0;
  const transitions = [];
  const stack = [];
  const state = () => `q${id++}`;
  const edge = (from, symbol, to) => transitions.push({ from, symbol, to });
  const snapshot = (title, detail, opType) =>
    steps.push({ title, detail, opType, states: id, transitions: transitions.length });

  for (const t of postfix) {
    if (t === "*" || t === "+" || t === "?") {
      if (!stack.length) throw new Error(`Operator ${t} has no operand.`);
      const a = stack.pop();
      const start = state();
      const end = state();

      if (t === "*") {
        edge(start, "ε", a.start);
        edge(start, "ε", end);
        edge(a.end, "ε", a.start);
        edge(a.end, "ε", end);
      } else if (t === "+") {
        edge(start, "ε", a.start);
        edge(a.end, "ε", a.start);
        edge(a.end, "ε", end);
      } else if (t === "?") {
        edge(start, "ε", a.start);
        edge(start, "ε", end);
        edge(a.end, "ε", end);
      }

      stack.push({ start, end });
      const opName = t === "*" ? "Kleene star" : t === "+" ? "Positive closure" : "Optional operator";
      snapshot(
        `Apply ${opName} (${t})`,
        `Create entry state ${start} and exit state ${end}; wire operand fragment via ε-transitions.`,
        t === "*" ? "star" : t === "+" ? "plus" : "opt"
      );
    } else if (t === ".") {
      if (stack.length < 2) throw new Error("Invalid concatenation.");
      const b = stack.pop();
      const a = stack.pop();
      edge(a.end, "ε", b.start);
      stack.push({ start: a.start, end: b.end });
      snapshot(
        "Concatenation",
        `Connect previous fragment exit (${a.end}) to next fragment entry (${b.start}) with an ε-transition.`,
        "concat"
      );
    } else if (t === "|") {
      if (stack.length < 2) throw new Error("Union needs two operands.");
      const b = stack.pop();
      const a = stack.pop();
      const start = state();
      const end = state();

      edge(start, "ε", a.start);
      edge(start, "ε", b.start);
      edge(a.end, "ε", end);
      edge(b.end, "ε", end);

      stack.push({ start, end });
      snapshot(
        "Union Alternation (|)",
        `Create new branching start ${start} and joining exit ${end}; parallelize both branches via ε.`,
        "union"
      );
    } else {
      const start = state();
      const end = state();
      edge(start, t === "ε" ? "ε" : t, end);
      stack.push({ start, end });
      snapshot(
        `Atomic Symbol "${t}"`,
        `Create two-state fragment ${start} —[${t}]→ ${end}.`,
        "symbol"
      );
    }
  }

  if (stack.length !== 1) {
    throw new Error("Invalid expression. Check operators and operands.");
  }

  return {
    start: stack[0].start,
    final: stack[0].end,
    transitions,
    states: Array.from({ length: id }, (_, i) => `q${i}`),
  };
}

/**
 * Normalizes state identifiers into a canonical topological order starting from q0 at entry
 * to q{N-1} at the final accepting state.
 */
function canonicalizeNfa(raw) {
  // Identify loop back-edges using DFS
  const visited = {};
  const onStack = {};
  const backEdges = new Set();

  function dfs(u) {
    visited[u] = true;
    onStack[u] = true;
    for (const e of raw.transitions) {
      if (e.from === u) {
        if (onStack[e.to]) {
          backEdges.add(e.from + "->" + e.to + ":" + e.symbol);
        } else if (!visited[e.to]) {
          dfs(e.to);
        }
      }
    }
    onStack[u] = false;
  }
  dfs(raw.start);

  // Compute topological distance ranks
  const rank = {};
  for (const s of raw.states) rank[s] = 0;
  for (let iter = 0; iter < raw.states.length; iter++) {
    for (const e of raw.transitions) {
      if (!backEdges.has(e.from + "->" + e.to + ":" + e.symbol)) {
        if (visited[e.from] && rank[e.to] < rank[e.from] + 1) {
          rank[e.to] = rank[e.from] + 1;
        }
      }
    }
  }

  // Sort states by rank, breaking ties deterministically
  const sorted = [...raw.states].sort((a, b) => {
    if (rank[a] !== rank[b]) return rank[a] - rank[b];
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const stateMap = {};
  sorted.forEach((oldId, i) => {
    stateMap[oldId] = `q${i}`;
  });

  return {
    start: stateMap[raw.start],
    final: stateMap[raw.final],
    states: sorted.map((s) => stateMap[s]),
    transitions: raw.transitions.map((e) => ({
      from: stateMap[e.from],
      symbol: e.symbol,
      to: stateMap[e.to],
    })),
    rawRanks: sorted.map((s) => rank[s]),
  };
}

function thompson(postfix) {
  const raw = rawThompson(postfix);
  return canonicalizeNfa(raw);
}

// ----------------------------------------------------------------------------
// 5. EPSILON-CLOSURE & SUBSET ACCEPTANCE SIMULATOR
// ----------------------------------------------------------------------------
function closure(states, targetNfa = nfa) {
  const result = new Set(states);
  const todo = [...states];

  while (todo.length) {
    const s = todo.pop();
    for (const e of targetNfa.transitions) {
      if (e.from === s && e.symbol === "ε" && !result.has(e.to)) {
        result.add(e.to);
        todo.push(e.to);
      }
    }
  }
  return result;
}

function accepts(input, targetNfa = nfa) {
  if (!targetNfa) return false;
  let active = closure([targetNfa.start], targetNfa);

  for (const ch of input) {
    const next = new Set();
    for (const s of active) {
      for (const e of targetNfa.transitions) {
        if (e.from === s && e.symbol === ch) {
          next.add(e.to);
        }
      }
    }
    active = closure(next, targetNfa);
  }

  return active.has(targetNfa.final);
}

/**
 * Performs character-by-character trace simulation for the interactive UI.
 */
function simulateWithTrace(input, targetNfa = nfa) {
  if (!targetNfa) return { accepted: false, trace: [] };

  const trace = [];
  let active = closure([targetNfa.start], targetNfa);
  trace.push({
    step: 0,
    char: "ε (Initial)",
    active: Array.from(active).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  });

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const direct = new Set();
    for (const s of active) {
      for (const e of targetNfa.transitions) {
        if (e.from === s && e.symbol === ch) {
          direct.add(e.to);
        }
      }
    }
    active = closure(direct, targetNfa);
    trace.push({
      step: i + 1,
      char: ch,
      active: Array.from(active).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    });
  }

  const accepted = active.has(targetNfa.final);
  return { accepted, trace, finalState: targetNfa.final };
}

// ----------------------------------------------------------------------------
// 6. PROFESSIONAL 2D HIERARCHICAL GRAPH LAYOUT & SVG ENGINE
// ----------------------------------------------------------------------------
function computeLayout(targetNfa) {
  // Re-rank states for clean 2D layout
  const rank = {};
  const backEdges = new Set();
  const visited = {};
  const onStack = {};

  function dfs(u) {
    visited[u] = true;
    onStack[u] = true;
    for (const e of targetNfa.transitions) {
      if (e.from === u) {
        if (onStack[e.to]) {
          backEdges.add(e.from + "->" + e.to);
        } else if (!visited[e.to]) {
          dfs(e.to);
        }
      }
    }
    onStack[u] = false;
  }
  dfs(targetNfa.start);

  for (const s of targetNfa.states) rank[s] = 0;
  for (let iter = 0; iter < targetNfa.states.length; iter++) {
    for (const e of targetNfa.transitions) {
      if (!backEdges.has(e.from + "->" + e.to)) {
        if (visited[e.from] && rank[e.to] < rank[e.from] + 1) {
          rank[e.to] = rank[e.from] + 1;
        }
      }
    }
  }

  // Group states by rank level
  const rankGroups = {};
  for (const s of targetNfa.states) {
    const r = rank[s] || 0;
    (rankGroups[r] ??= []).push(s);
  }

  const maxRank = Math.max(0, ...Object.keys(rankGroups).map(Number));
  const X_PAD = 90;
  const X_SPACING = 135;
  const Y_CENTER = 210;
  const Y_TRACK_SPACING = 95;

  const coords = {};
  for (const [rStr, group] of Object.entries(rankGroups)) {
    const r = Number(rStr);
    const count = group.length;
    group.forEach((s, idx) => {
      const x = X_PAD + r * X_SPACING;
      // Stagger vertical positioning around center line
      const yOffset = (idx - (count - 1) / 2) * Y_TRACK_SPACING;
      coords[s] = { x, y: Y_CENTER + yOffset, rank: r };
    });
  }

  const width = Math.max(880, X_PAD * 2 + maxRank * X_SPACING + 60);
  const height = 440;

  return { coords, width, height, backEdges };
}

function renderGraph() {
  const svg = document.getElementById("graph");
  if (!svg || !nfa) return;

  const { coords, width, height } = computeLayout(nfa);
  baseViewBox = { width, height };

  updateSvgTransform();
  svg.innerHTML = "";

  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    parent.appendChild(e);
    return e;
  };

  // Define SVG Marker Arrows & Drop Shadow Filters
  const defs = el("defs", {});

  // Drop shadow filter for states
  const filter = el("filter", { id: "nodeShadow", x: "-20%", y: "-20%", width: "150%", height: "150%" }, defs);
  el("feDropShadow", { dx: "0", dy: "3", stdDeviation: "3.5", "flood-color": "#0f172a", "flood-opacity": "0.12" }, filter);

  // Normal transition arrowhead (symbol)
  const markerSymbol = el("marker", {
    id: "arrowSymbol",
    markerWidth: "9",
    markerHeight: "9",
    refX: "8",
    refY: "4.5",
    orient: "auto",
  }, defs);
  el("path", { d: "M 0 1.5 L 8 4.5 L 0 7.5 z", fill: "#0284c7" }, markerSymbol);

  // Epsilon transition arrowhead
  const markerEps = el("marker", {
    id: "arrowEps",
    markerWidth: "9",
    markerHeight: "9",
    refX: "8",
    refY: "4.5",
    orient: "auto",
  }, defs);
  el("path", { d: "M 0 1.5 L 8 4.5 L 0 7.5 z", fill: "#7c3aed" }, markerEps);

  // Initial State start arrow marker
  const markerStart = el("marker", {
    id: "arrowStart",
    markerWidth: "10",
    markerHeight: "10",
    refX: "9",
    refY: "5",
    orient: "auto",
  }, defs);
  el("path", { d: "M 0 2 L 9 5 L 0 8 z", fill: "#2563eb" }, markerStart);

  // Canvas background rect for smooth panning
  el("rect", { width, height, fill: "transparent" });

  // Main graph container group
  const graphGroup = el("g", { id: "graphViewport" });

  // Draw Initial State Incoming Arrow
  const startCoord = coords[nfa.start];
  if (startCoord) {
    const sx = startCoord.x;
    const sy = startCoord.y;
    el("path", {
      d: `M ${sx - 65} ${sy} L ${sx - 24} ${sy}`,
      stroke: "#2563eb",
      "stroke-width": "2.5",
      fill: "none",
      "marker-end": "url(#arrowStart)",
    }, graphGroup);

    // "START" Text Pill
    const textStart = el("text", {
      x: sx - 45,
      y: sy - 8,
      "text-anchor": "middle",
      "font-size": "10",
      "font-family": "Inter, sans-serif",
      "font-weight": "800",
      fill: "#2563eb",
      "letter-spacing": "0.5px",
    }, graphGroup);
    textStart.textContent = "START";
  }

  // Group transitions by connection pair to offset parallel edges
  const edgeGroups = {};
  nfa.transitions.forEach((e) => {
    const key = e.from + "->" + e.to;
    (edgeGroups[key] ??= []).push(e);
  });

  // Render Transitions
  for (const [key, edgeList] of Object.entries(edgeGroups)) {
    const fromId = edgeList[0].from;
    const toId = edgeList[0].to;
    const c1 = coords[fromId];
    const c2 = coords[toId];
    if (!c1 || !c2) continue;

    const isSelf = fromId === toId;
    const isForward = c2.x > c1.x;
    const isDirectNeighbor = Math.abs(c2.rank - c1.rank) === 1;

    edgeList.forEach((e, idx) => {
      const isEps = e.symbol === "ε";
      const strokeColor = isEps ? "#8b5cf6" : "#0284c7";
      const markerUrl = isEps ? "url(#arrowEps)" : "url(#arrowSymbol)";
      const multiOffset = (idx - (edgeList.length - 1) / 2) * 22;

      let d = "";
      let labelX = 0;
      let labelY = 0;

      if (isSelf) {
        // Self-loop: loop over the top
        const lx = c1.x;
        const ly = c1.y - 20;
        d = `M ${lx - 12} ${ly} C ${lx - 45} ${ly - 70 - multiOffset} ${lx + 45} ${ly - 70 - multiOffset} ${lx + 12} ${ly}`;
        labelX = lx;
        labelY = ly - 56 - multiOffset;
      } else if (isForward) {
        if (isDirectNeighbor && Math.abs(c1.y - c2.y) < 10) {
          // Horizontal adjacent step
          const yMid = c1.y + multiOffset;
          d = `M ${c1.x + 20} ${yMid} L ${c2.x - 22} ${yMid}`;
          labelX = (c1.x + c2.x) / 2;
          labelY = yMid - 10;
        } else if (c1.y !== c2.y) {
          // Different track branch (e.g. Union branch)
          const midX = (c1.x + c2.x) / 2;
          d = `M ${c1.x + 18} ${c1.y} C ${midX} ${c1.y} ${midX} ${c2.y} ${c2.x - 22} ${c2.y}`;
          labelX = midX;
          labelY = (c1.y + c2.y) / 2 + multiOffset - 6;
        } else {
          // Forward long jump (e.g. Star or Optional bypass): Arch overhead
          const span = c2.x - c1.x;
          const arcHeight = Math.min(130, 45 + Math.sqrt(span) * 4) + multiOffset;
          const peakY = c1.y - arcHeight;
          d = `M ${c1.x + 14} ${c1.y - 14} Q ${(c1.x + c2.x) / 2} ${peakY} ${c2.x - 14} ${c2.y - 14}`;
          labelX = (c1.x + c2.x) / 2;
          labelY = (c1.y + peakY) / 2 - 4;
        }
      } else {
        // Backward loop (e.g. Star loop-back): Arch gracefully UNDER the states
        const span = c1.x - c2.x;
        const arcDepth = Math.min(140, 50 + Math.sqrt(span) * 4.5) + multiOffset;
        const bottomY = Math.max(c1.y, c2.y) + arcDepth;
        d = `M ${c1.x - 14} ${c1.y + 14} Q ${(c1.x + c2.x) / 2} ${bottomY} ${c2.x + 14} ${c2.y + 14}`;
        labelX = (c1.x + c2.x) / 2;
        labelY = bottomY - 14;
      }

      // Draw Path Edge
      el("path", {
        d,
        fill: "none",
        stroke: strokeColor,
        "stroke-width": "1.8",
        "stroke-linecap": "round",
        "marker-end": markerUrl,
        class: "svg-edge",
        "data-from": fromId,
        "data-to": toId,
      }, graphGroup);

      // Label Pill Background
      const pillWidth = isEps ? 20 : 22;
      const pillHeight = 18;
      el("rect", {
        x: labelX - pillWidth / 2,
        y: labelY - pillHeight / 2 - 2,
        width: pillWidth,
        height: pillHeight,
        rx: "5",
        ry: "5",
        fill: isEps ? "#f5f3ff" : "#f0f9ff",
        stroke: isEps ? "#c4b5fd" : "#7dd3fc",
        "stroke-width": "1",
      }, graphGroup);

      // Label Text
      const text = el("text", {
        x: labelX,
        y: labelY + 2.5,
        "text-anchor": "middle",
        "font-size": isEps ? "12" : "11.5",
        "font-family": "JetBrains Mono, monospace",
        "font-weight": "700",
        fill: isEps ? "#6d28d9" : "#0369a1",
      }, graphGroup);
      text.textContent = e.symbol;
    });
  }

  // Render State Nodes
  for (const s of nfa.states) {
    const c = coords[s];
    if (!c) continue;

    const isStart = s === nfa.start;
    const isFinal = s === nfa.final;

    const nodeG = el("g", {
      class: "svg-node",
      "data-state": s,
      transform: `translate(${c.x}, ${c.y})`,
    }, graphGroup);

    // Outer Drop Shadow Ring
    el("circle", {
      r: "20",
      fill: isStart ? "#eff6ff" : "#ffffff",
      stroke: isFinal ? "#059669" : isStart ? "#2563eb" : "#3b82f6",
      "stroke-width": isFinal ? "2.5" : "2",
      class: "node-bg",
      filter: "url(#nodeShadow)",
    }, nodeG);

    // Final State Concentric Inner Double Ring
    if (isFinal) {
      el("circle", {
        r: "15.5",
        fill: "none",
        stroke: "#059669",
        "stroke-width": "1.5",
      }, nodeG);
    }

    // State Identifier Label
    const lbl = el("text", {
      x: "0",
      y: "4.5",
      "text-anchor": "middle",
      "font-size": "12",
      "font-family": "JetBrains Mono, monospace",
      "font-weight": "700",
      fill: isFinal ? "#065f46" : isStart ? "#1e3a8a" : "#0f172a",
    }, nodeG);
    lbl.textContent = s;

    // Node Interactive Tooltip / Hover Highlight
    nodeG.addEventListener("mouseenter", () => highlightState(s));
    nodeG.addEventListener("mouseleave", clearHighlight);
  }
}

// ----------------------------------------------------------------------------
// INTERACTIVE HIGHLIGHTING & PAN/ZOOM CONTROLS
// ----------------------------------------------------------------------------
function highlightState(stateId) {
  const edges = document.querySelectorAll(".svg-edge");
  edges.forEach((edge) => {
    const from = edge.getAttribute("data-from");
    const to = edge.getAttribute("data-to");
    if (from === stateId || to === stateId) {
      edge.style.stroke = "#2563eb";
      edge.style.strokeWidth = "3.2";
      edge.style.opacity = "1";
    } else {
      edge.style.opacity = "0.2";
    }
  });
}

function clearHighlight() {
  const edges = document.querySelectorAll(".svg-edge");
  edges.forEach((edge) => {
    edge.style.stroke = "";
    edge.style.strokeWidth = "";
    edge.style.opacity = "1";
  });
}

function updateSvgTransform() {
  const svg = document.getElementById("graph");
  if (!svg) return;
  const w = baseViewBox.width * zoomLevel;
  const h = baseViewBox.height * zoomLevel;
  svg.setAttribute("viewBox", `${panX} ${panY} ${w} ${h}`);
}

function setupPanZoom() {
  const container = document.getElementById("graphContainer");
  if (!container) return;

  container.addEventListener("mousedown", (e) => {
    isPanning = true;
    startPanX = e.clientX;
    startPanY = e.clientY;
    container.classList.add("grabbing");
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    const dx = (e.clientX - startPanX) * zoomLevel;
    const dy = (e.clientY - startPanY) * zoomLevel;
    panX -= dx;
    panY -= dy;
    startPanX = e.clientX;
    startPanY = e.clientY;
    updateSvgTransform();
  });

  window.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      container.classList.remove("grabbing");
    }
  });

  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    zoomLevel = Math.max(0.4, Math.min(2.5, zoomLevel * factor));
    updateSvgTransform();
  }, { passive: false });

  document.getElementById("zoomInBtn")?.addEventListener("click", () => {
    zoomLevel = Math.max(0.4, zoomLevel * 0.85);
    updateSvgTransform();
  });

  document.getElementById("zoomOutBtn")?.addEventListener("click", () => {
    zoomLevel = Math.min(2.5, zoomLevel * 1.15);
    updateSvgTransform();
  });

  document.getElementById("zoomResetBtn")?.addEventListener("click", () => {
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    updateSvgTransform();
  });

  document.getElementById("exportSvgBtn")?.addEventListener("click", exportSvgDiagram);
}

function exportSvgDiagram() {
  const svg = document.getElementById("graph");
  if (!svg) return;
  const serializer = new XMLSerializer();
  const source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "thompson_nfa_diagram.svg";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------------
// 7. STEP INSPECTOR, STRING SIMULATOR & TABLE CONTROLLERS
// ----------------------------------------------------------------------------
function showStep() {
  const el = document.getElementById("stepText");
  const counter = document.getElementById("stepCounter");
  const bar = document.getElementById("stepProgressBar");
  if (!el || !counter) return;

  const total = steps.length;
  counter.textContent = `Step ${total ? currentStep + 1 : 0} / ${total}`;

  if (bar) {
    const pct = total ? ((currentStep + 1) / total) * 100 : 0;
    bar.style.width = `${pct}%`;
  }

  if (!total) {
    el.innerHTML = "Build an automaton to inspect Thompson fragment construction steps.";
    return;
  }

  const s = steps[currentStep];
  el.innerHTML = `
    <div class="step-badge-op">${s.opType || "Construction"}</div>
    <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${s.title}</div>
    <div style="color: #475569;">${s.detail}</div>
    <div class="step-metrics">Stage Snapshot: ${s.states} states generated · ${s.transitions} transitions logged</div>
  `;
}

function renderTable(filterText = "") {
  const body = document.getElementById("transitionRows");
  if (!body || !nfa) return;
  body.innerHTML = "";

  const query = filterText.toLowerCase().trim();
  const filtered = nfa.transitions.filter((e) => {
    if (!query) return true;
    return (
      e.from.toLowerCase().includes(query) ||
      e.to.toLowerCase().includes(query) ||
      e.symbol.toLowerCase().includes(query)
    );
  });

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty-row">${nfa.transitions.length ? "No matching transitions found for query." : "No transitions in automaton."}</td></tr>`;
    return;
  }

  for (const e of filtered) {
    const tr = document.createElement("tr");
    const isEps = e.symbol === "ε";

    tr.innerHTML = `
      <td><span class="state-badge">${e.from}</span></td>
      <td><span class="table-symbol-badge ${isEps ? "epsilon" : "symbol"}">${e.symbol}</span></td>
      <td><span class="state-badge">${e.to}</span></td>
      <td><span class="type-pill">${isEps ? "Null Transition (ε)" : "Alphabet Symbol"}</span></td>
    `;
    body.appendChild(tr);
  }
}

function runStringTest() {
  const resultBox = document.getElementById("testResult");
  const traceBox = document.getElementById("simTrace");
  if (!resultBox || !traceBox) return;

  if (!nfa) {
    resultBox.className = "test-result-box neutral";
    resultBox.textContent = "Build an automaton first.";
    traceBox.innerHTML = '<div class="empty-trace">Build an automaton first.</div>';
    return;
  }

  const inputStr = document.getElementById("testString").value;
  const { accepted, trace, finalState } = simulateWithTrace(inputStr, nfa);

  resultBox.className = "test-result-box " + (accepted ? "accept" : "reject");
  resultBox.innerHTML = accepted
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> ACCEPTED — String "${inputStr}" is in the language L(M).`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> REJECTED — String "${inputStr}" is NOT in the language L(M).`;

  // Render Trace Steps
  traceBox.innerHTML = "";
  trace.forEach((t) => {
    const isFinalStep = t.step === trace.length - 1;
    const stepEl = document.createElement("div");
    stepEl.className = "trace-step";

    const statePills = t.active
      .map((s) => (s === finalState && isFinalStep ? `<span class="final-state-hit">${s}★</span>` : s))
      .join(", ");

    stepEl.innerHTML = `
      <span style="color:#64748b; font-weight:700;">Step ${t.step}:</span>
      <span class="trace-char">${t.char}</span>
      <span style="color:#94a3b8;">→</span>
      <span class="trace-set">{ ${statePills || "∅"} }</span>
    `;
    traceBox.appendChild(stepEl);
  });
}

// ----------------------------------------------------------------------------
// 8. MASTER BUILD & EVENT BINDINGS
// ----------------------------------------------------------------------------
function build() {
  const errorEl = document.getElementById("error");
  const resultBox = document.getElementById("testResult");
  const traceBox = document.getElementById("simTrace");

  if (errorEl) {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }
  if (resultBox) {
    resultBox.className = "test-result-box neutral";
    resultBox.textContent = "Build an automaton and enter a string to simulate acceptance.";
  }
  if (traceBox) {
    traceBox.innerHTML = '<div class="empty-trace">No string simulated yet. Enter a string and click "Test String".</div>';
  }

  try {
    steps = [];
    const rawInput = document.getElementById("regex").value;
    const tokens = addConcat(tokenizeRegex(rawInput));
    const postfix = toPostfix(tokens);
    nfa = thompson(postfix);
    currentStep = steps.length - 1;

    // Reset Zoom / Pan Coordinates
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;

    document.getElementById("stateCount").textContent = nfa.states.length;
    document.getElementById("transitionCount").textContent = nfa.transitions.length;
    document.getElementById("startState").textContent = nfa.start;
    document.getElementById("finalState").textContent = nfa.final;

    renderGraph();
    renderTable();
    showStep();
  } catch (e) {
    nfa = null;
    if (errorEl) {
      errorEl.textContent = e.message;
      errorEl.style.display = "block";
    }
    document.getElementById("stateCount").textContent = "—";
    document.getElementById("transitionCount").textContent = "—";
    document.getElementById("startState").textContent = "—";
    document.getElementById("finalState").textContent = "—";
  }
}

// Browser Event Bindings
if (typeof document !== "undefined") {
  document.getElementById("buildBtn")?.addEventListener("click", build);

  document.getElementById("regex")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") build();
  });

  document.getElementById("prevStep")?.addEventListener("click", () => {
    if (steps.length) {
      currentStep = Math.max(0, currentStep - 1);
      showStep();
    }
  });

  document.getElementById("nextStep")?.addEventListener("click", () => {
    if (steps.length) {
      currentStep = Math.min(steps.length - 1, currentStep + 1);
      showStep();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (document.activeElement?.tagName === "INPUT") return;
    if (e.key === "ArrowLeft") {
      if (steps.length) {
        currentStep = Math.max(0, currentStep - 1);
        showStep();
      }
    } else if (e.key === "ArrowRight") {
      if (steps.length) {
        currentStep = Math.min(steps.length - 1, currentStep + 1);
        showStep();
      }
    }
  });

  document.getElementById("testBtn")?.addEventListener("click", runStringTest);
  document.getElementById("testString")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runStringTest();
  });

  document.getElementById("tableSearch")?.addEventListener("input", (e) => {
    renderTable(e.target.value);
  });

  // Example Preset Chips
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".preset-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const input = document.getElementById("regex");
      input.value = chip.getAttribute("data-regex");
      build();
    });
  });

  setupPanZoom();

  // Automatic build on initial load
  build();
}

// ----------------------------------------------------------------------------
// 9. COMMONJS / NODE.JS EXPORTS FOR AUTOMATED TESTING
// ----------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    tokenizeRegex,
    addConcat,
    toPostfix,
    thompson,
    closure,
    accepts,
    simulateWithTrace,
    getNfa: () => nfa,
    setNfa: (newNfa) => { nfa = newNfa; },
    getSteps: () => steps,
  };
}
