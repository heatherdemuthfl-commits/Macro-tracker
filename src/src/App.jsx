import { useState, useEffect, useRef } from "react";

const GOALS = {
  calories: 2000,
  protein: 180,
  carbs: 188,
  fat: 60,
  currentWeight: 178,
  goalWeight: 165,
};

const QUICK_ADDS = [
  { name: "2 Eggs", protein: 12, carbs: 1, fat: 10, calories: 140 },
  { name: "Siggi's Vanilla", protein: 16, carbs: 9, fat: 0, calories: 100 },
  { name: "Chomps Stick", protein: 9, carbs: 0, fat: 6, calories: 90 },
  { name: "RX Bar Choc Sea Salt", protein: 12, carbs: 23, fat: 8, calories: 210 },
  { name: "Cottage Cheese ½c", protein: 14, carbs: 4, fat: 2, calories: 90 },
  { name: "Chicken Sausage", protein: 14, carbs: 1, fat: 7, calories: 120 },
  { name: "Strawberries 1c", protein: 1, carbs: 11, fat: 0, calories: 45 },
  { name: "Protein Shake", protein: 25, carbs: 5, fat: 2, calories: 130 },
];

function getRingColor(pct) {
  if (pct >= 100) return "#ef4444";
  if (pct >= 75) return "#22c55e";
  if (pct >= 40) return "#f59e0b";
  return "#94a3b8";
}

function Ring({ value, goal, label, color, unit = "g" }) {
  const pct = Math.min((value / goal) * 100, 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const ringColor = color || getRingColor(pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={ringColor} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{ marginTop: -66, marginBottom: 18, textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", fontFamily: "'DM Mono', monospace" }}>
          {value}<span style={{ fontSize: 11, color: "#94a3b8" }}>{unit}</span>
        </div>
        <div style={{ fontSize: 9, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
          of {goal}{unit}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
        {label}
      </div>
    </div>
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function MacroTracker() {
  const [entries, setEntries] = useState([]);
  const [allDays, setAllDays] = useState({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [workoutDay, setWorkoutDay] = useState(true);
  const [viewDate, setViewDate] = useState(todayKey());
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef();

  const calorieGoal = workoutDay ? 2050 : 1850;

  useEffect(() => {
    const saved = localStorage.getItem("macrotracker-all-days");
    if (saved) {
      const data = JSON.parse(saved);
      setAllDays(data);
      setEntries(data[todayKey()] || []);
    }
  }, []);

  useEffect(() => {
    if (Object.keys(allDays).length === 0 && entries.length === 0) return;
    const updated = { ...allDays, [viewDate]: entries };
    setAllDays(updated);
    localStorage.setItem("macrotracker-all-days", JSON.stringify(updated));
  }, [entries]);

  const totals = entries.reduce(
    (acc, e) => ({
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
      calories: acc.calories + (e.calories || 0),
    }),
    { protein: 0, carbs: 0, fat: 0, calories: 0 }
  );

  async function lookupFood(foodText) {
    setLoading(true);
    setAiStatus("Looking up macros...");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `You are a nutrition database. Given this food entry: "${foodText}"
Return ONLY a JSON object (no markdown, no explanation) with these exact fields:
{
  "name": "display name for the food",
  "protein": number in grams,
  "carbs": number in grams,
  "fat": number in grams,
  "calories": number
}
Use realistic, accurate nutrition data. If a quantity is specified, use that quantity.`
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAiStatus("");
      return parsed;
    } catch (e) {
      setAiStatus("Couldn't look up that food. Try again.");
      setTimeout(() => setAiStatus(""), 3000);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!input.trim()) return;
    const food = await lookupFood(input.trim());
    if (food) {
      setEntries(prev => [...prev, { ...food, id: Date.now() }]);
      setInput("");
      inputRef.current?.focus();
    }
  }

  function handleQuickAdd(item) {
    setEntries(prev => [...prev, { ...item, id: Date.now() }]);
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  function switchDay(date) {
    setViewDate(date);
    setEntries(allDays[date] || []);
    setShowHistory(false);
  }

  const calPct = Math.min((totals.calories / calorieGoal) * 100, 100);
  const proteinPct = (totals.protein / GOALS.protein) * 100;
  const remainingProtein = Math.max(GOALS.protein - totals.protein, 0);
  const remainingCal = Math.max(calorieGoal - totals.calories, 0);

  const historyDates = Object.keys(allDays).sort().reverse().filter(d => d !== todayKey());

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f1a",
      fontFamily: "'DM Sans', sans-serif",
      color: "#f1f5f9",
      padding: "0 0 80px 0",
    }}>
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderBottom: "1px solid #1e293b",
        padding: "20px 20px 16px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#22d3ee", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
              MACRO TRACKER
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", fontFamily: "'DM Mono', monospace" }}>
              {viewDate === todayKey() ? "Today" : viewDate}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setWorkoutDay(w => !w)} style={{
              padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: workoutDay ? "#22d3ee22" : "#1e293b",
              color: workoutDay ? "#22d3ee" : "#64748b",
              letterSpacing: 1,
            }}>
              {workoutDay ? "💪 WORKOUT" : "REST DAY"}
            </button>
            <button onClick={() => setShowHistory(h => !h)} style={{
              padding: "6px 12px", borderRadius: 20, border: "1px solid #1e293b", cursor: "pointer", fontSize: 11,
              background: "transparent", color: "#64748b",
            }}>
              {showHistory ? "✕" : "HISTORY"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>CALORIES</span>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: calPct >= 100 ? "#ef4444" : "#22d3ee" }}>
              {totals.calories} / {calorieGoal} kcal
            </span>
          </div>
          <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${calPct}%`, borderRadius: 3,
              background: calPct >= 100 ? "#ef4444" : calPct >= 75 ? "#22c55e" : "#22d3ee",
              transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
            }} />
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 4, textAlign: "right" }}>
            {remainingCal > 0 ? `${remainingCal} kcal remaining` : "Goal reached! 🎯"}
          </div>
        </div>
      </div>

      {showHistory && (
        <div style={{ background: "#0f172a", borderBottom: "1px solid #1​​​​​​​​​​​​​​​​
